//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Capteurs des cartes graphiques, lus auprès du pilote déjà installé, sans
// rien installer : NVML (nvml.dll, fourni avec le pilote NVIDIA) et ADL
// (atiadlxx.dll, fourni avec le pilote AMD). Les cartes Intel n'exposent pas
// leur température ; leur charge vient des compteurs Windows.

type gpuReader interface {
	read() []sensor
}

// openGPUs returns the readers of the graphics cards found on this PC.
func openGPUs(logf func(string, ...any)) []gpuReader {
	var out []gpuReader
	if n := openNVML(); n != nil {
		out = append(out, n)
		logf("Capteurs NVIDIA : %d carte(s)", len(n.devs))
	}
	if a := openADL(); a != nil {
		out = append(out, a)
		logf("Capteurs AMD : %d carte(s)", len(a.adapters))
	}
	return out
}

// sane keeps a reading only when it is a plausible value.
func sane(v, lo, hi float64) bool { return v >= lo && v <= hi }

// ---------------------------------------------------------------- NVIDIA (NVML)

type nvml struct {
	temp, util, power, clock, fan *windows.Proc
	devs                          []nvDev
}

type nvDev struct {
	h    uintptr
	name string
}

func openNVML() *nvml {
	var dll *windows.DLL
	for _, p := range []string{
		filepath.Join(os.Getenv("SystemRoot"), "System32", "nvml.dll"),
		filepath.Join(os.Getenv("ProgramFiles"), "NVIDIA Corporation", "NVSMI", "nvml.dll"),
	} {
		if d, err := windows.LoadDLL(p); err == nil {
			dll = d
			break
		}
	}
	if dll == nil {
		return nil
	}
	proc := func(name string) *windows.Proc { p, _ := dll.FindProc(name); return p }
	initp, count, byIndex, name := proc("nvmlInit_v2"), proc("nvmlDeviceGetCount_v2"), proc("nvmlDeviceGetHandleByIndex_v2"), proc("nvmlDeviceGetName")
	if initp == nil || count == nil || byIndex == nil {
		return nil
	}
	if r, _, _ := initp.Call(); r != 0 {
		return nil
	}
	n := &nvml{temp: proc("nvmlDeviceGetTemperature"), util: proc("nvmlDeviceGetUtilizationRates"),
		power: proc("nvmlDeviceGetPowerUsage"), clock: proc("nvmlDeviceGetClockInfo"), fan: proc("nvmlDeviceGetFanSpeed")}
	var c uint32
	if r, _, _ := count.Call(uintptr(unsafe.Pointer(&c))); r != 0 {
		return nil
	}
	for i := uint32(0); i < c; i++ {
		var h uintptr
		if r, _, _ := byIndex.Call(uintptr(i), uintptr(unsafe.Pointer(&h))); r != 0 {
			continue
		}
		nm := fmt.Sprintf("NVIDIA %d", i+1)
		if name != nil {
			buf := make([]byte, 96)
			if r, _, _ := name.Call(h, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf))); r == 0 {
				nm = strings.TrimSpace(windows.ByteSliceToString(buf))
			}
		}
		n.devs = append(n.devs, nvDev{h: h, name: nm})
	}
	if len(n.devs) == 0 {
		return nil
	}
	return n
}

func (n *nvml) read() []sensor {
	var out []sensor
	for i, d := range n.devs {
		g := "Carte graphique · " + d.name
		id := fmt.Sprintf("nv%d:", i)
		var u uint32
		if n.temp != nil {
			if r, _, _ := n.temp.Call(d.h, 0, uintptr(unsafe.Pointer(&u))); r == 0 && sane(float64(u), 1, 150) {
				out = append(out, sensor{ID: id + "temp", G: g, L: "Température", U: "°C", V: float64(u), K: "gpuTemp"})
			}
		}
		if n.util != nil {
			var ut struct{ GPU, Mem uint32 }
			if r, _, _ := n.util.Call(d.h, uintptr(unsafe.Pointer(&ut))); r == 0 && ut.GPU <= 100 {
				out = append(out, sensor{ID: id + "load", G: g, L: "Charge", U: "%", V: float64(ut.GPU), K: "gpuLoad"},
					sensor{ID: id + "memload", G: g, L: "Charge mémoire", U: "%", V: float64(ut.Mem)})
			}
		}
		if n.power != nil {
			if r, _, _ := n.power.Call(d.h, uintptr(unsafe.Pointer(&u))); r == 0 && sane(float64(u)/1000, 0, 1000) {
				out = append(out, sensor{ID: id + "power", G: g, L: "Consommation", U: "W", V: round2(float64(u) / 1000), K: "gpuPower"})
			}
		}
		if n.clock != nil {
			if r, _, _ := n.clock.Call(d.h, 0, uintptr(unsafe.Pointer(&u))); r == 0 && sane(float64(u), 1, 5000) {
				out = append(out, sensor{ID: id + "clock", G: g, L: "Fréquence", U: "MHz", V: float64(u)})
			}
		}
		if n.fan != nil {
			if r, _, _ := n.fan.Call(d.h, uintptr(unsafe.Pointer(&u))); r == 0 && u <= 100 {
				out = append(out, sensor{ID: id + "fan", G: g, L: "Ventilateur", U: "%", V: float64(u)})
			}
		}
	}
	return out
}

// ---------------------------------------------------------------- AMD (ADL)

const (
	adlAdapterInfoSize = 1572 // sizeof(AdapterInfo)
	adlPMLogMaxSensors = 256
	// ADLSensorType
	adlGfxClk       = 1
	adlTempEdge     = 8
	adlFanPct       = 15
	adlActivityGfx  = 19
	adlAsicPower    = 23
	adlTempHotspot  = 27
	adlVendorAMD    = 1002
	adlOK           = 0
	adlOD5TempIndex = 0
)

type adl struct {
	ctx                  uintptr
	pmlog, od5temp, od5a *windows.Proc
	adapters             []adlAdapter
}

type adlAdapter struct {
	index int32
	name  string
}

type adlPMLog struct {
	Size    int32
	Sensors [adlPMLogMaxSensors]struct{ Supported, Value int32 }
}

var adlAlloc = windows.NewCallback(func(size uintptr) uintptr {
	p, _ := windows.LocalAlloc(windows.LPTR, uint32(size))
	return p
})

func openADL() *adl {
	dll, err := windows.LoadDLL(filepath.Join(os.Getenv("SystemRoot"), "System32", "atiadlxx.dll"))
	if err != nil {
		return nil
	}
	proc := func(name string) *windows.Proc { p, _ := dll.FindProc(name); return p }
	create, num, info := proc("ADL2_Main_Control_Create"), proc("ADL2_Adapter_NumberOfAdapters_Get"), proc("ADL2_Adapter_AdapterInfo_Get")
	if create == nil || num == nil || info == nil {
		return nil
	}
	a := &adl{pmlog: proc("ADL2_New_QueryPMLogData_Get"), od5temp: proc("ADL2_Overdrive5_Temperature_Get"), od5a: proc("ADL2_Overdrive5_CurrentActivity_Get")}
	if r, _, _ := create.Call(adlAlloc, 1, uintptr(unsafe.Pointer(&a.ctx))); int32(r) != adlOK {
		return nil
	}
	var n int32
	if r, _, _ := num.Call(a.ctx, uintptr(unsafe.Pointer(&n))); int32(r) != adlOK || n <= 0 || n > 64 {
		return nil
	}
	buf := make([]byte, int(n)*adlAdapterInfoSize)
	if r, _, _ := info.Call(a.ctx, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf))); int32(r) != adlOK {
		return nil
	}
	seen := map[int32]bool{}
	for i := 0; i < int(n); i++ {
		b := buf[i*adlAdapterInfoSize:]
		i32 := func(off int) int32 { return *(*int32)(unsafe.Pointer(&b[off])) }
		// AdapterInfo: iSize, iAdapterIndex, strUDID[256], iBusNumber, iDeviceNumber, iFunctionNumber, iVendorID, strAdapterName[256]…
		idx, bus, vendor := i32(4), i32(264), i32(276)
		if vendor != adlVendorAMD || seen[bus] {
			continue
		}
		seen[bus] = true
		a.adapters = append(a.adapters, adlAdapter{index: idx, name: strings.TrimSpace(windows.ByteSliceToString(b[280 : 280+256]))})
	}
	if len(a.adapters) == 0 {
		return nil
	}
	return a
}

func (a *adl) read() []sensor {
	var out []sensor
	for i, ad := range a.adapters {
		g := "Carte graphique · " + ad.name
		id := fmt.Sprintf("amd%d:", i)
		got := false
		if a.pmlog != nil {
			var pm adlPMLog
			if r, _, _ := a.pmlog.Call(a.ctx, uintptr(ad.index), uintptr(unsafe.Pointer(&pm))); int32(r) == adlOK {
				v := func(k int) (float64, bool) { s := pm.Sensors[k]; return float64(s.Value), s.Supported != 0 }
				if t, ok := v(adlTempEdge); ok && sane(t, 1, 150) {
					out = append(out, sensor{ID: id + "temp", G: g, L: "Température", U: "°C", V: t, K: "gpuTemp"})
					got = true
				}
				if t, ok := v(adlTempHotspot); ok && sane(t, 1, 150) {
					out = append(out, sensor{ID: id + "hot", G: g, L: "Point chaud", U: "°C", V: t})
				}
				if x, ok := v(adlActivityGfx); ok && sane(x, 0, 100) {
					out = append(out, sensor{ID: id + "load", G: g, L: "Charge", U: "%", V: x, K: "gpuLoad"})
				}
				if x, ok := v(adlAsicPower); ok && sane(x, 0, 1000) {
					out = append(out, sensor{ID: id + "power", G: g, L: "Consommation", U: "W", V: x, K: "gpuPower"})
				}
				if x, ok := v(adlGfxClk); ok && sane(x, 1, 5000) {
					out = append(out, sensor{ID: id + "clock", G: g, L: "Fréquence", U: "MHz", V: x})
				}
				if x, ok := v(adlFanPct); ok && sane(x, 0, 100) {
					out = append(out, sensor{ID: id + "fan", G: g, L: "Ventilateur", U: "%", V: x})
				}
			}
		}
		if got {
			continue
		}
		// anciennes cartes (Overdrive 5)
		if a.od5temp != nil {
			t := struct{ Size, Temp int32 }{Size: 8}
			if r, _, _ := a.od5temp.Call(a.ctx, uintptr(ad.index), adlOD5TempIndex, uintptr(unsafe.Pointer(&t))); int32(r) == adlOK && sane(float64(t.Temp)/1000, 1, 150) {
				out = append(out, sensor{ID: id + "temp", G: g, L: "Température", U: "°C", V: round2(float64(t.Temp) / 1000), K: "gpuTemp"})
			}
		}
		if a.od5a != nil {
			act := struct{ Size, Engine, Memory, Vddc, Activity, Level, Bus, Lanes, MaxLanes, Reserved int32 }{Size: 40}
			if r, _, _ := a.od5a.Call(a.ctx, uintptr(ad.index), uintptr(unsafe.Pointer(&act))); int32(r) == adlOK && sane(float64(act.Activity), 0, 100) {
				out = append(out, sensor{ID: id + "load", G: g, L: "Charge", U: "%", V: float64(act.Activity), K: "gpuLoad"})
			}
		}
	}
	return out
}
