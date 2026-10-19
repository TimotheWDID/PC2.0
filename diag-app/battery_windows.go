//go:build windows

package main

import (
	"context"
	"encoding/json"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

// Test de décharge : relève charge, puissance et tension toutes les 15 s
// pendant la durée choisie, éventuellement sous charge CPU.

type battTest struct {
	cancel context.CancelFunc
	paused atomic.Bool
	stop   atomic.Bool
}

func readBatteryPoint(ctx context.Context) (map[string]any, bool) {
	c, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	out, err := psCommand(c, batteryPointPS).Output()
	if err != nil {
		return nil, false
	}
	var p map[string]any
	if json.Unmarshal([]byte(strings.TrimSpace(string(out))), &p) != nil || len(p) == 0 {
		return nil, false
	}
	return p, true
}

func (a *app) batteryTest(minutes int, load bool) bool {
	if minutes <= 0 || minutes > 120 || !hasBattery() {
		return false
	}
	a.mu.Lock()
	if a.batt != nil {
		a.mu.Unlock()
		return false
	}
	ctx, cancel := context.WithCancel(context.Background())
	bt := &battTest{cancel: cancel}
	a.batt = bt
	a.mu.Unlock()

	if load {
		for i := 0; i < runtime.NumCPU(); i++ {
			go func() {
				x := 1.0
				for ctx.Err() == nil {
					if bt.paused.Load() {
						time.Sleep(200 * time.Millisecond)
						continue
					}
					for j := 0; j < 1e6; j++ {
						x = x*1.0000001 + 1e-9
					}
				}
				_ = x
			}()
		}
	}

	go func() {
		defer func() {
			cancel()
			a.mu.Lock()
			a.batt = nil
			a.mu.Unlock()
		}()
		target := minutes * 60
		a.log("Test de batterie : %d min, charge CPU %v", minutes, load)
		p, ok := readBatteryPoint(ctx)
		if !ok {
			a.emitGo("battError", "La batterie n'a pas pu être lue (aucune batterie détectée ou valeurs non fournies par le contrôleur).")
			return
		}
		a.emitGo("battPoint", p)
		elapsed, sinceLast := 0, 0
		for elapsed < target && !bt.stop.Load() {
			time.Sleep(time.Second)
			if bt.paused.Load() {
				continue
			}
			elapsed++
			sinceLast++
			a.emitGo("battTick", map[string]any{"elapsed": elapsed, "target": target})
			if sinceLast >= 15 && elapsed < target {
				sinceLast = 0
				go func() {
					if p, ok := readBatteryPoint(ctx); ok {
						a.emitGo("battPoint", p)
					}
				}()
			}
		}
		// dernière mesure avant la fin, pour le calcul de la décharge
		if p, ok := readBatteryPoint(ctx); ok {
			a.emitGo("battPoint", p)
		}
		a.emitGo("battDone", map[string]any{"seconds": elapsed, "stopped": bt.stop.Load()})
	}()
	return true
}

func (a *app) batteryCtl(c string) bool {
	a.mu.Lock()
	bt := a.batt
	a.mu.Unlock()
	if bt == nil {
		return false
	}
	switch c {
	case "pause":
		bt.paused.Store(true)
	case "resume":
		bt.paused.Store(false)
	case "stop":
		bt.paused.Store(false)
		bt.stop.Store(true)
	default:
		return false
	}
	return true
}
