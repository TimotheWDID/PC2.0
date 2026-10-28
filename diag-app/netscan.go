package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Scan réseau d'un audit : chaque adresse du sous-réseau du PC est interrogée
// (ARP sous Windows, puis quelques ports TCP courants), sans rien installer ni
// droits particuliers. Le résultat part sur l'audit du site.

// netHost is one device found on the LAN, as the site stores it.
type netHost struct {
	IP       string `json:"ip"`
	MAC      string `json:"mac,omitempty"`
	Hostname string `json:"hostname,omitempty"`
	Vendor   string `json:"vendor,omitempty"`
	Kind     string `json:"kind,omitempty"`
	KindHint string `json:"kind_hint,omitempty"`
	Ports    []int  `json:"ports,omitempty"`
	RTTms    int    `json:"rtt_ms,omitempty"`
	Self     bool   `json:"self,omitempty"`
	Gateway  bool   `json:"gateway,omitempty"`
}

type netScanResult struct {
	Interface  string    `json:"interface"`
	Subnet     string    `json:"subnet"`
	LocalIP    string    `json:"local_ip"`
	LocalMAC   string    `json:"local_mac,omitempty"`
	Gateway    string    `json:"gateway,omitempty"`
	DNS        string    `json:"dns,omitempty"`
	DurationMs int       `json:"duration_ms"`
	Hosts      []netHost `json:"hosts"`
	Truncated  bool      `json:"truncated,omitempty"`
	Date       string    `json:"date"`
}

// netPorts are probed on every host that answers: they tell what it is.
var netPorts = []int{21, 22, 23, 53, 80, 88, 135, 139, 389, 443, 445, 515, 548, 554, 631, 1433, 3389, 5000, 5001, 5900, 8080, 8443, 9100, 37777}

// netMaxHosts caps the scan: a /22 at most, else the /24 of the PC.
const netMaxHosts = 1022

// netLocal is the network the PC is on (interface with the default gateway).
type netLocal struct {
	Name    string
	IP      net.IP
	Mask    net.IPMask
	MAC     string
	Gateway string
	DNS     []string
}

// subnetHosts lists the host addresses of ip/mask (network and broadcast
// excluded). A network larger than netMaxHosts is reduced to the /24 of ip.
func subnetHosts(ip net.IP, mask net.IPMask) ([]net.IP, string, bool) {
	ip4 := ip.To4()
	if ip4 == nil || len(mask) != 4 {
		return nil, "", false
	}
	ones, _ := mask.Size()
	truncated := false
	if ones < 22 {
		ones, truncated = 24, true
	}
	if ones > 30 {
		ones = 30
	}
	m := net.CIDRMask(ones, 32)
	base := binary.BigEndian.Uint32(ip4.Mask(m))
	size := uint32(1) << (32 - ones)
	out := make([]net.IP, 0, size-2)
	for i := uint32(1); i < size-1; i++ {
		b := make(net.IP, 4)
		binary.BigEndian.PutUint32(b, base+i)
		out = append(out, b)
	}
	return out, fmt.Sprintf("%s/%d", net.IP(ip4.Mask(m)).String(), ones), truncated
}

func formatMAC(b []byte) string {
	if len(b) < 6 {
		return ""
	}
	allZero := true
	for _, x := range b[:6] {
		if x != 0 {
			allZero = false
		}
	}
	if allZero {
		return ""
	}
	return strings.ToUpper(net.HardwareAddr(b[:6]).String())
}

// probePorts returns the open TCP ports of ip among ports (connect, short timeout).
func probePorts(ip string, ports []int, timeout time.Duration) ([]int, int) {
	var (
		mu   sync.Mutex
		open []int
		rtt  int
		wg   sync.WaitGroup
	)
	for _, p := range ports {
		wg.Add(1)
		go func(p int) {
			defer wg.Done()
			start := time.Now()
			c, err := net.DialTimeout("tcp", net.JoinHostPort(ip, fmt.Sprint(p)), timeout)
			if err != nil {
				return
			}
			c.Close()
			ms := int(time.Since(start).Milliseconds())
			mu.Lock()
			open = append(open, p)
			if rtt == 0 || ms < rtt {
				rtt = ms
			}
			mu.Unlock()
		}(p)
	}
	wg.Wait()
	sort.Ints(open)
	return open, rtt
}

// nbstatRequest is a NetBIOS « node status » query for the name "*".
func nbstatRequest(id uint16) []byte {
	b := make([]byte, 0, 50)
	b = append(b, byte(id>>8), byte(id), 0, 0, 0, 1, 0, 0, 0, 0, 0, 0)
	b = append(b, 0x20, 'C', 'K')
	for i := 0; i < 30; i++ {
		b = append(b, 'A')
	}
	return append(b, 0, 0, 0x21, 0, 1)
}

// parseNbstat reads the computer name (unique name, suffix 0x00), the
// workgroup (group name, suffix 0x00) and the MAC of a node status answer.
func parseNbstat(b []byte) (name, group, mac string) {
	const off = 56 // header 12 + name 34 + type, class, TTL, length 10
	if len(b) < off+1 {
		return
	}
	n := int(b[off])
	p := off + 1
	for i := 0; i < n && p+18 <= len(b); i, p = i+1, p+18 {
		label := strings.TrimRight(string(b[p:p+15]), " \x00")
		suffix := b[p+15]
		isGroup := b[p+16]&0x80 != 0
		if suffix != 0 || label == "" {
			continue
		}
		if isGroup && group == "" {
			group = label
		} else if !isGroup && name == "" {
			name = label
		}
	}
	if p+6 <= len(b) {
		mac = formatMAC(b[p : p+6])
	}
	return
}

// netbiosName asks a Windows PC (or a NAS) its NetBIOS name.
func netbiosName(ip string, timeout time.Duration) (string, string, string) {
	c, err := net.DialTimeout("udp", net.JoinHostPort(ip, "137"), timeout)
	if err != nil {
		return "", "", ""
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(timeout))
	if _, err := c.Write(nbstatRequest(0x5043)); err != nil {
		return "", "", ""
	}
	buf := make([]byte, 1024)
	n, err := c.Read(buf)
	if err != nil {
		return "", "", ""
	}
	return parseNbstat(buf[:n])
}

var htmlTitle = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)

// httpTitle reads the title of the web page of a device (printer, NAS,
// camera, box…): it usually names the brand and model.
func httpTitle(ip string, port int, timeout time.Duration) string {
	client := &http.Client{Timeout: timeout, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 || req.URL.Hostname() != ip {
			return http.ErrUseLastResponse
		}
		return nil
	}}
	resp, err := client.Get(fmt.Sprintf("http://%s:%d/", ip, port))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(bufio.NewReader(resp.Body), 64<<10))
	title := ""
	if m := htmlTitle.FindSubmatch(body); m != nil {
		title = strings.Join(strings.Fields(htmlUnescape(string(m[1]))), " ")
	}
	if title == "" {
		title = strings.TrimSpace(resp.Header.Get("Server"))
	}
	if r := []rune(title); len(r) > 120 {
		title = string(r[:120])
	}
	return title
}

func htmlUnescape(s string) string {
	return strings.NewReplacer("&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", `"`, "&#39;", "'", "&nbsp;", " ").Replace(s)
}

var (
	reKindPrinter = regexp.MustCompile(`(?i)printer|imprimante|laserjet|officejet|deskjet|brother|epson|canon|kyocera|ricoh|xerox|lexmark|konica|sharp mx|oki`)
	reKindNAS     = regexp.MustCompile(`(?i)synology|diskstation|qnap|nas\b|truenas|freenas|readynas|terramaster|asustor`)
	reKindCamera  = regexp.MustCompile(`(?i)hikvision|dahua|camera|caméra|ipcam|nvr|dvr|reolink|axis`)
	reKindRouter  = regexp.MustCompile(`(?i)livebox|freebox|bbox|sfr ?box|routeur|router|fortigate|sophos|pfsense|opnsense|draytek|mikrotik|zyxel`)
	reKindAP      = regexp.MustCompile(`(?i)unifi|access point|borne|omada|aruba instant`)
	reKindSwitch  = regexp.MustCompile(`(?i)switch|procurve|catalyst`)
	reKindPhone   = regexp.MustCompile(`(?i)^(android|iphone|galaxy|pixel|redmi|xiaomi|huawei|oppo)`)
	reKindTablet  = regexp.MustCompile(`(?i)^ipad|tablet|tab-`)
)

func hasPort(ports []int, want ...int) bool {
	for _, p := range ports {
		for _, w := range want {
			if p == w {
				return true
			}
		}
	}
	return false
}

// guessKind names what a host probably is, from its open ports, its web page
// title and its name. The hint says why, for the technician.
func guessKind(h netHost, title string) (string, string) {
	text := title + " " + h.Hostname
	switch {
	case h.Self:
		return "computer", "PC du scan"
	case h.Gateway:
		return "router", firstNonEmpty(title, "Passerelle du réseau")
	case reKindPrinter.MatchString(text) || hasPort(h.Ports, 9100, 515, 631):
		return "printer", firstNonEmpty(title, "Impression (ports 9100, 515 ou 631)")
	case reKindCamera.MatchString(text) || hasPort(h.Ports, 554, 37777):
		return "camera", firstNonEmpty(title, "Flux vidéo (RTSP)")
	case reKindNAS.MatchString(text) || (hasPort(h.Ports, 5000, 5001, 548) && !hasPort(h.Ports, 3389, 135)):
		return "nas", firstNonEmpty(title, "Partage de fichiers")
	case hasPort(h.Ports, 88) && hasPort(h.Ports, 389):
		return "server", "Contrôleur de domaine (Kerberos, LDAP)"
	case hasPort(h.Ports, 1433) || (hasPort(h.Ports, 3389) && hasPort(h.Ports, 53)):
		return "server", firstNonEmpty(title, "Serveur Windows")
	case reKindRouter.MatchString(text):
		return "router", title
	case reKindAP.MatchString(text):
		return "access_point", title
	case reKindSwitch.MatchString(text):
		return "switch", title
	case reKindPhone.MatchString(h.Hostname):
		return "phone", ""
	case reKindTablet.MatchString(h.Hostname):
		return "tablet", ""
	case hasPort(h.Ports, 445, 135, 139, 3389):
		return "computer", "Windows (partage de fichiers ou bureau à distance)"
	case hasPort(h.Ports, 22) && len(h.Ports) <= 2:
		return "other", firstNonEmpty(title, "Linux ou équipement réseau (SSH)")
	case hasPort(h.Ports, 80, 443, 8080, 8443):
		return "other", firstNonEmpty(title, "Interface web")
	}
	return "other", title
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return s
		}
	}
	return ""
}

// netProgress is sent to the interface while the scan runs (event « netProgress »).
type netProgress struct {
	Done  int `json:"done"`
	Total int `json:"total"`
	Found int `json:"found"`
}

// runNetScan scans the PC's network: alive(ip) says whether an address
// answers and gives its MAC (ARP under Windows), then each host found is
// probed (ports, names, web page).
func runNetScan(local netLocal, alive func(ip net.IP) (string, bool), progress func(netProgress), cancel <-chan struct{}) (*netScanResult, error) {
	start := time.Now()
	ips, subnet, truncated := subnetHosts(local.IP, local.Mask)
	if len(ips) == 0 {
		return nil, fmt.Errorf("pas d'adresse IPv4 sur la carte réseau %s", local.Name)
	}
	res := &netScanResult{
		Interface: local.Name, Subnet: subnet, LocalIP: local.IP.String(), LocalMAC: local.MAC,
		Gateway: local.Gateway, DNS: strings.Join(local.DNS, ", "), Truncated: truncated,
		Date: start.Format(time.RFC3339), Hosts: []netHost{},
	}

	var (
		mu    sync.Mutex
		done  int
		hosts []netHost
		wg    sync.WaitGroup
	)
	jobs := make(chan net.IP)
	for w := 0; w < 64; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ip := range jobs {
				h, ok := scanHost(ip, local, alive)
				mu.Lock()
				done++
				if ok {
					hosts = append(hosts, h)
				}
				p := netProgress{Done: done, Total: len(ips), Found: len(hosts)}
				mu.Unlock()
				if progress != nil && (p.Done%8 == 0 || p.Done == p.Total) {
					progress(p)
				}
			}
		}()
	}
feed:
	for _, ip := range ips {
		select {
		case <-cancel:
			break feed
		case jobs <- ip:
		}
	}
	close(jobs)
	wg.Wait()
	select {
	case <-cancel:
		return nil, fmt.Errorf("scan réseau arrêté")
	default:
	}

	sort.Slice(hosts, func(i, j int) bool {
		return binary.BigEndian.Uint32(net.ParseIP(hosts[i].IP).To4()) < binary.BigEndian.Uint32(net.ParseIP(hosts[j].IP).To4())
	})
	res.Hosts = hosts
	res.DurationMs = int(time.Since(start).Milliseconds())
	return res, nil
}

func scanHost(ip net.IP, local netLocal, alive func(net.IP) (string, bool)) (netHost, bool) {
	s := ip.String()
	h := netHost{IP: s, Self: ip.Equal(local.IP), Gateway: s == local.Gateway}
	switch {
	case h.Self:
		h.MAC = local.MAC
	case alive != nil:
		// an address that does not answer ARP is not on the LAN
		mac, ok := alive(ip)
		if !ok {
			return h, false
		}
		h.MAC = mac
	}
	h.Ports, h.RTTms = probePorts(s, netPorts, 700*time.Millisecond)
	if alive == nil && !h.Self && len(h.Ports) == 0 {
		return h, false
	}

	if names, err := net.LookupAddr(s); err == nil && len(names) > 0 {
		h.Hostname = strings.TrimSuffix(names[0], ".")
	}
	if hasPort(h.Ports, 139, 445) || h.Hostname == "" {
		if name, _, nbMAC := netbiosName(s, 800*time.Millisecond); name != "" {
			if h.Hostname == "" {
				h.Hostname = name
			}
			if h.MAC == "" {
				h.MAC = nbMAC
			}
		}
	}
	title := ""
	for _, p := range []int{80, 8080} {
		if hasPort(h.Ports, p) {
			if title = httpTitle(s, p, 2*time.Second); title != "" {
				break
			}
		}
	}
	h.Kind, h.KindHint = guessKind(h, title)
	return h, true
}
