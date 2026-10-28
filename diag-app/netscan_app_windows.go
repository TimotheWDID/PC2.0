//go:build windows

package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Scan réseau lancé depuis l'écran Audit : il tourne en arrière-plan, envoie
// sa progression (« netProgress ») puis son résultat (« netDone » ou
// « netError ») à l'interface, et reste enregistré dans PC2Diag-rapports pour
// être envoyé plus tard si le site est injoignable.

var netState struct {
	sync.Mutex
	running bool
	cancel  chan struct{}
	last    *netScanResult
}

func (a *app) startNetScan() bool {
	netState.Lock()
	if netState.running {
		netState.Unlock()
		return false
	}
	netState.running = true
	cancel := make(chan struct{})
	netState.cancel = cancel
	netState.Unlock()

	go func() {
		local, err := localNetwork()
		var res *netScanResult
		if err == nil {
			a.log("Scan réseau : %s (%s/%d) depuis %s", local.Name, local.IP, maskBits(local), a.machine)
			res, err = runNetScan(local, arpAlive, func(p netProgress) { a.emitGo("netProgress", p) }, cancel)
		}
		netState.Lock()
		netState.running = false
		if err == nil {
			netState.last = res
		}
		netState.Unlock()
		if err != nil {
			a.log("Scan réseau en échec : %v", err)
			a.emitGo("netError", err.Error())
			return
		}
		saveNetScan(res)
		a.log("Scan réseau terminé : %d équipement(s) sur %s en %d s", len(res.Hosts), res.Subnet, res.DurationMs/1000)
		a.emitGo("netDone", res)
	}()
	return true
}

func maskBits(l netLocal) int {
	ones, _ := l.Mask.Size()
	return ones
}

func cancelNetScan() bool {
	netState.Lock()
	defer netState.Unlock()
	if !netState.running || netState.cancel == nil {
		return false
	}
	close(netState.cancel)
	netState.cancel = nil
	return true
}

// lastNetScan is the scan of this session, else the last one saved next to the exe.
func lastNetScan() *netScanResult {
	netState.Lock()
	defer netState.Unlock()
	if netState.last != nil {
		return netState.last
	}
	matches, _ := filepath.Glob(filepath.Join(reportsDir(), "Reseau_*.json"))
	if len(matches) == 0 {
		return nil
	}
	b, err := os.ReadFile(matches[len(matches)-1])
	if err != nil {
		return nil
	}
	var r netScanResult
	if json.Unmarshal(b, &r) != nil {
		return nil
	}
	netState.last = &r
	return &r
}

func saveNetScan(r *netScanResult) {
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(reportsDir(), "Reseau_"+time.Now().Format("2006-01-02_15h04m05")+".json"), b, 0o600)
}

func (a *app) sendNetScan(auditID int, addDevices bool) (any, error) {
	r := lastNetScan()
	if r == nil {
		return nil, errors.New("lancez d'abord le scan du réseau")
	}
	out, err := a.client().SendScan(auditID, r, addDevices)
	if err != nil {
		a.log("Envoi du scan réseau en échec : %v", err)
		return nil, err
	}
	a.log("Scan réseau envoyé à l'audit %d (%d équipement(s))", auditID, len(r.Hosts))
	return out, nil
}

func (a *app) sendAudit(auditID int, t AuditTarget, exp AtelierExport) (*AuditSendResult, error) {
	if t.IP == "" || t.MAC == "" {
		// adresse du PC sur le réseau du client, pour le retrouver parmi les équipements du scan
		if l, err := localNetwork(); err == nil {
			if t.IP == "" {
				t.IP = l.IP.String()
			}
			if t.MAC == "" {
				t.MAC = l.MAC
			}
		}
	}
	res, err := a.client().SendAudit(auditID, t, exp)
	if err != nil {
		a.log("Envoi à l'audit %d en échec : %v", auditID, err)
		return nil, err
	}
	a.log("Analyse envoyée à l'audit %d", auditID)
	return res, nil
}
