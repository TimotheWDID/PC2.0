//go:build !windows

package main

import (
	"errors"
	"net"
)

// Hors Windows (tests, développement) : pas d'ARP, les hôtes sont trouvés par leurs ports.

var arpAlive func(net.IP) (string, bool)

func localNetwork() (netLocal, error) {
	ifs, err := net.Interfaces()
	if err != nil {
		return netLocal{}, err
	}
	for _, i := range ifs {
		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			if n, ok := a.(*net.IPNet); ok && n.IP.To4() != nil {
				return netLocal{Name: i.Name, IP: n.IP.To4(), Mask: n.Mask[len(n.Mask)-4:], MAC: formatMAC(i.HardwareAddr)}, nil
			}
		}
	}
	return netLocal{}, errors.New("aucune carte réseau IPv4 connectée")
}
