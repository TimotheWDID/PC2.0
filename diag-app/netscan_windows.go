//go:build windows

package main

import (
	"errors"
	"net"
	"sort"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

var procSendARP = windows.NewLazySystemDLL("iphlpapi.dll").NewProc("SendARP")

// arpAlive asks the MAC of ip on the LAN (SendARP): every device answers
// ARP, even with its firewall closed.
func arpAlive(ip net.IP) (string, bool) {
	ip4 := ip.To4()
	if ip4 == nil {
		return "", false
	}
	dest := uint32(ip4[0]) | uint32(ip4[1])<<8 | uint32(ip4[2])<<16 | uint32(ip4[3])<<24
	var mac [8]byte
	size := uint32(len(mac))
	r, _, _ := procSendARP.Call(uintptr(dest), 0, uintptr(unsafe.Pointer(&mac[0])), uintptr(unsafe.Pointer(&size)))
	if r != 0 || size < 6 {
		return "", false
	}
	return formatMAC(mac[:6]), true
}

// localNetwork is the connected card with a default gateway (the lowest
// metric first), with its IPv4 address, mask, gateway and DNS servers.
func localNetwork() (netLocal, error) {
	const gaaIncludeGateways = 0x80
	size := uint32(16 << 10)
	var buf []byte
	for i := 0; i < 3; i++ {
		buf = make([]byte, size)
		err := windows.GetAdaptersAddresses(windows.AF_INET, gaaIncludeGateways, 0, (*windows.IpAdapterAddresses)(unsafe.Pointer(&buf[0])), &size)
		if err == nil {
			break
		}
		if err != windows.ERROR_BUFFER_OVERFLOW {
			return netLocal{}, err
		}
	}
	type cand struct {
		l      netLocal
		metric uint32
	}
	var list []cand
	for a := (*windows.IpAdapterAddresses)(unsafe.Pointer(&buf[0])); a != nil; a = a.Next {
		if a.OperStatus != windows.IfOperStatusUp || a.IfType == windows.IF_TYPE_SOFTWARE_LOOPBACK || a.FirstGatewayAddress == nil {
			continue
		}
		l := netLocal{Name: windows.UTF16PtrToString(a.FriendlyName)}
		if a.PhysicalAddressLength >= 6 {
			l.MAC = formatMAC(a.PhysicalAddress[:6])
		}
		for u := a.FirstUnicastAddress; u != nil; u = u.Next {
			if ip := u.Address.IP().To4(); ip != nil && !ip.IsLinkLocalUnicast() {
				l.IP, l.Mask = ip, net.CIDRMask(int(u.OnLinkPrefixLength), 32)
				break
			}
		}
		if l.IP == nil {
			continue
		}
		for g := a.FirstGatewayAddress; g != nil; g = g.Next {
			if ip := g.Address.IP().To4(); ip != nil {
				l.Gateway = ip.String()
				break
			}
		}
		for d := a.FirstDnsServerAddress; d != nil; d = d.Next {
			if ip := d.Address.IP(); ip != nil && ip.To4() != nil {
				l.DNS = append(l.DNS, ip.String())
			}
		}
		// VPN et cartes virtuelles en dernier
		metric := a.Ipv4Metric
		if strings.Contains(strings.ToLower(windows.UTF16PtrToString(a.Description)), "virtual") || a.IfType == 53 {
			metric += 10000
		}
		list = append(list, cand{l, metric})
	}
	if len(list) == 0 {
		return netLocal{}, errors.New("aucune carte réseau connectée avec une passerelle : branchez le PC au réseau du client")
	}
	sort.Slice(list, func(i, j int) bool { return list[i].metric < list[j].metric })
	return list[0].l, nil
}
