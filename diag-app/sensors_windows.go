//go:build windows

package main

import (
	"math"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Capteurs en direct : compteurs de performance Windows (PDH), lus chaque
// seconde et envoyés à l'interface (événement « sensors »).

var (
	pdh                             = windows.NewLazySystemDLL("pdh.dll")
	procPdhOpenQuery                = pdh.NewProc("PdhOpenQueryW")
	procPdhAddEnglishCounter        = pdh.NewProc("PdhAddEnglishCounterW")
	procPdhCollectQueryData         = pdh.NewProc("PdhCollectQueryData")
	procPdhGetFormattedCounterValue = pdh.NewProc("PdhGetFormattedCounterValue")
	procPdhGetFormattedCounterArray = pdh.NewProc("PdhGetFormattedCounterArrayW")
)

const (
	pdhFmtDouble   = 0x00000200
	pdhFmtNoCap100 = 0x00008000
	pdhMoreData    = 0x800007D2
)

type pdhValue struct {
	CStatus uint32
	_       uint32
	Double  float64
}

type pdhItem struct {
	Name  *uint16
	Value pdhValue
}

type sensorDef struct {
	id, group, label, unit, path string
	array                        bool                                 // compteur avec instances (*)
	conv                         func(v float64) float64              // conversion de l'unité
	each                         func(name string, v float64) *sensor // une ligne par instance
	h                            uintptr
}

func addCounter(q uintptr, path string) uintptr {
	var h uintptr
	p, _ := windows.UTF16PtrFromString(path)
	if r, _, _ := procPdhAddEnglishCounter.Call(q, uintptr(unsafe.Pointer(p)), 0, uintptr(unsafe.Pointer(&h))); r != 0 {
		return 0
	}
	return h
}

func counterValue(h uintptr) (float64, bool) {
	var v pdhValue
	r, _, _ := procPdhGetFormattedCounterValue.Call(h, pdhFmtDouble|pdhFmtNoCap100, 0, uintptr(unsafe.Pointer(&v)))
	if r != 0 || v.CStatus > 1 {
		return 0, false
	}
	return v.Double, true
}

func counterArray(h uintptr) map[string]float64 {
	var size, count uint32
	r, _, _ := procPdhGetFormattedCounterArray.Call(h, pdhFmtDouble|pdhFmtNoCap100, uintptr(unsafe.Pointer(&size)), uintptr(unsafe.Pointer(&count)), 0)
	if uint32(r) != pdhMoreData || size == 0 {
		return nil
	}
	buf := make([]byte, size)
	r, _, _ = procPdhGetFormattedCounterArray.Call(h, pdhFmtDouble|pdhFmtNoCap100, uintptr(unsafe.Pointer(&size)), uintptr(unsafe.Pointer(&count)), uintptr(unsafe.Pointer(&buf[0])))
	if r != 0 {
		return nil
	}
	items := unsafe.Slice((*pdhItem)(unsafe.Pointer(&buf[0])), count)
	out := make(map[string]float64, count)
	for _, it := range items {
		if it.Value.CStatus > 1 {
			continue
		}
		out[windows.UTF16PtrToString(it.Name)] += it.Value.Double
	}
	return out
}

func sum(m map[string]float64, skip func(string) bool) float64 {
	t := 0.0
	for k, v := range m {
		if skip == nil || !skip(k) {
			t += v
		}
	}
	return t
}

func (a *app) startSensors() {
	a.mu.Lock()
	if a.sensorsOn {
		a.mu.Unlock()
		return
	}
	a.sensorsOn = true
	a.mu.Unlock()
	go a.sensorLoop()
}

func (a *app) sensorLoop() {
	var q uintptr
	if r, _, _ := procPdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&q))); r != 0 {
		a.log("Capteurs indisponibles (PdhOpenQuery %#x)", r)
		q = 0
	}
	toMB := func(v float64) float64 { return v / 1048576 }
	toMbit := func(v float64) float64 { return v * 8 / 1e6 }
	defs := []*sensorDef{
		// « % Processor Utility » est rapporté à la fréquence de base : il dépasse 100 %
		// dès que le Turbo Boost monte au-delà. Le Gestionnaire des tâches le borne aussi à 100.
		{id: "cpu", group: "Processeur", label: "Utilisation", unit: "%", path: `\Processor Information(_Total)\% Processor Utility`, conv: func(v float64) float64 { return math.Min(100, v) }},
		{id: "cpuperf", path: `\Processor Information(_Total)\% Processor Performance`},
		{id: "cpubase", path: `\Processor Information(_Total)\Processor Frequency`},
		{id: "cpuq", group: "Processeur", label: "File d'attente", unit: "", path: `\System\Processor Queue Length`},
		{id: "disk", group: "Disques", label: "Activité", unit: "%", path: `\PhysicalDisk(_Total)\% Idle Time`, conv: func(v float64) float64 { return math.Max(0, 100-v) }},
		{id: "diskR", group: "Disques", label: "Lecture", unit: "Mo/s", path: `\PhysicalDisk(_Total)\Disk Read Bytes/sec`, conv: toMB},
		{id: "diskW", group: "Disques", label: "Écriture", unit: "Mo/s", path: `\PhysicalDisk(_Total)\Disk Write Bytes/sec`, conv: toMB},
		{id: "diskQ", group: "Disques", label: "File d'attente", unit: "", path: `\PhysicalDisk(_Total)\Current Disk Queue Length`},
		{id: "netR", group: "Réseau", label: "Réception", unit: "Mbit/s", path: `\Network Interface(*)\Bytes Received/sec`, array: true, conv: toMbit},
		{id: "netS", group: "Réseau", label: "Envoi", unit: "Mbit/s", path: `\Network Interface(*)\Bytes Sent/sec`, array: true, conv: toMbit},
		{id: "gpu", group: "Carte graphique", label: "Utilisation 3D", unit: "%", path: `\GPU Engine(*engtype_3D)\Utilization Percentage`, array: true, conv: func(v float64) float64 { return math.Min(100, v) }},
		{id: "pagef", group: "Mémoire", label: "Fichier d'échange", unit: "%", path: `\Paging File(_Total)\% Usage`},
		{id: "procs", group: "Système", label: "Processus", unit: "", path: `\System\Processes`},
		{id: "threads", group: "Système", label: "Threads", unit: "", path: `\System\Threads`},
		{id: "therm", path: `\Thermal Zone Information(*)\Temperature`, array: true, each: func(name string, v float64) *sensor {
			c := v - 273.15
			if c <= 0 || c > 150 {
				return nil
			}
			n := strings.TrimPrefix(name, `\_TZ.`)
			return &sensor{ID: "therm:" + n, G: "Températures", L: "Zone " + n, U: "°C", V: math.Round(c*10) / 10}
		}},
	}
	if q != 0 {
		for _, d := range defs {
			d.h = addCounter(q, d.path)
		}
		// Ancien Windows : pas de « % Processor Utility »
		if defs[0].h == 0 {
			defs[0].h = addCounter(q, `\Processor(_Total)\% Processor Time`)
		}
		procPdhCollectQueryData.Call(q)
	}

	gpus := openGPUs(a.log)
	for range time.Tick(time.Second) {
		var out []sensor
		vals := map[string]float64{}
		if q != 0 {
			procPdhCollectQueryData.Call(q)
		}
		for _, d := range defs {
			if d.h == 0 {
				continue
			}
			var v float64
			if d.array {
				m := counterArray(d.h)
				if m == nil {
					continue
				}
				if d.each != nil {
					for name, x := range m {
						if s := d.each(name, x); s != nil {
							out = append(out, *s)
						}
					}
					continue
				}
				v = sum(m, func(n string) bool {
					n = strings.ToLower(n)
					return strings.Contains(n, "loopback") || strings.Contains(n, "isatap") || strings.Contains(n, "teredo")
				})
			} else {
				x, ok := counterValue(d.h)
				if !ok {
					continue
				}
				v = x
			}
			if d.conv != nil {
				v = d.conv(v)
			}
			vals[d.id] = v
			if d.group != "" {
				out = append(out, sensor{ID: d.id, G: d.group, L: d.label, U: d.unit, V: round2(v)})
			}
		}
		if base, ok := vals["cpubase"]; ok && base > 0 {
			if perf, ok := vals["cpuperf"]; ok {
				out = append(out, sensor{ID: "cpuf", G: "Processeur", L: "Fréquence", U: "MHz", V: math.Round(base * perf / 100)})
			}
		}
		if m, ok := memoryStatus(); ok {
			used := float64(m.TotalPhys-m.AvailPhys) / (1 << 30)
			out = append(out,
				sensor{ID: "ram", G: "Mémoire", L: "Utilisée", U: "%", V: float64(m.MemoryLoad)},
				sensor{ID: "ramUsed", G: "Mémoire", L: "Utilisée", U: "Go", V: round2(used)},
				sensor{ID: "ramFree", G: "Mémoire", L: "Disponible", U: "Go", V: round2(float64(m.AvailPhys) / (1 << 30))},
			)
		}
		if p, ok := powerState(); ok && p.BatteryFlag != 128 && p.BatteryFlag != 255 && p.BatteryLifePercent <= 100 {
			out = append(out,
				sensor{ID: "bat", G: "Batterie", L: "Charge", U: "%", V: float64(p.BatteryLifePercent)},
				sensor{ID: "ac", G: "Batterie", L: "Sur secteur", U: "bool", V: boolF(p.ACLineStatus == 1)},
			)
		}
		for _, g := range gpus {
			out = append(out, g.read()...)
		}
		out = append(out, readHWiNFO()...)
		out = append(out, sensor{ID: "uptime", G: "Système", L: "Allumé depuis", U: "h", V: round2(uptimeHours())})
		a.emitGo("sensors", out)
	}
}

func boolF(b bool) float64 {
	if b {
		return 1
	}
	return 0
}
