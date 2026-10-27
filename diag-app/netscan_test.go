package main

import (
	"net"
	"strconv"
	"testing"
	"time"
)

func TestSubnetHosts(t *testing.T) {
	ips, subnet, truncated := subnetHosts(net.ParseIP("192.168.1.20"), net.CIDRMask(24, 32))
	if len(ips) != 254 || subnet != "192.168.1.0/24" || truncated {
		t.Fatalf("got %d hosts, %s, %v", len(ips), subnet, truncated)
	}
	if ips[0].String() != "192.168.1.1" || ips[253].String() != "192.168.1.254" {
		t.Fatalf("bounds %s %s", ips[0], ips[253])
	}
	// a /16 is reduced to the /24 of the PC
	ips, subnet, truncated = subnetHosts(net.ParseIP("10.0.5.7"), net.CIDRMask(16, 32))
	if len(ips) != 254 || subnet != "10.0.5.0/24" || !truncated {
		t.Fatalf("got %d hosts, %s, %v", len(ips), subnet, truncated)
	}
	ips, subnet, _ = subnetHosts(net.ParseIP("172.16.4.9"), net.CIDRMask(22, 32))
	if len(ips) != 1022 || subnet != "172.16.4.0/22" {
		t.Fatalf("got %d hosts, %s", len(ips), subnet)
	}
}

func TestParseNbstat(t *testing.T) {
	b := make([]byte, 56)
	b = append(b, 3)
	name := func(label string, suffix byte, flags uint16) []byte {
		r := []byte(label)
		for len(r) < 15 {
			r = append(r, ' ')
		}
		return append(r, suffix, byte(flags>>8), byte(flags))
	}
	b = append(b, name("PC-COMPTA", 0x20, 0x0400)...)
	b = append(b, name("WORKGROUP", 0x00, 0x8400)...)
	b = append(b, name("PC-COMPTA", 0x00, 0x0400)...)
	b = append(b, 0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e)
	n, g, mac := parseNbstat(b)
	if n != "PC-COMPTA" || g != "WORKGROUP" || mac != "00:1A:2B:3C:4D:5E" {
		t.Fatalf("got %q %q %q", n, g, mac)
	}
	if n, _, _ := parseNbstat([]byte{1, 2}); n != "" {
		t.Fatal("short packet")
	}
	if req := nbstatRequest(1); len(req) != 50 {
		t.Fatalf("request length %d", len(req))
	}
}

func TestGuessKind(t *testing.T) {
	cases := []struct {
		h     netHost
		title string
		want  string
	}{
		{netHost{Gateway: true, Ports: []int{80}}, "Livebox", "router"},
		{netHost{Ports: []int{80, 9100}}, "", "printer"},
		{netHost{Ports: []int{80}}, "Brother MFC-L2710DW series", "printer"},
		{netHost{Ports: []int{80, 554}}, "", "camera"},
		{netHost{Ports: []int{80, 5000, 5001}}, "", "nas"},
		{netHost{Ports: []int{53, 88, 135, 389, 445}}, "", "server"},
		{netHost{Ports: []int{135, 139, 445}}, "", "computer"},
		{netHost{Hostname: "iPhone-de-Julie.home"}, "", "phone"},
		{netHost{Ports: []int{22}}, "", "other"},
		{netHost{Self: true}, "", "computer"},
	}
	for _, c := range cases {
		if got, _ := guessKind(c.h, c.title); got != c.want {
			t.Errorf("%+v %q: got %s, want %s", c.h, c.title, got, c.want)
		}
	}
}

func TestProbePorts(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skip(err)
	}
	defer l.Close()
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			c.Close()
		}
	}()
	port := l.Addr().(*net.TCPAddr).Port
	open, _ := probePorts("127.0.0.1", []int{port, 1}, 500*time.Millisecond)
	if len(open) != 1 || open[0] != port {
		t.Fatalf("open ports %v, want [%s]", open, strconv.Itoa(port))
	}
}
