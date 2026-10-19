package main

import (
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

// Lecture de la mémoire partagée de HWiNFO (voir hwinfo_windows.go).

const (
	hwinfoSM       = `Global\HWiNFO_SENS_SM2`
	hwinfoSig      = 0x53695748 // « HWiS »
	hwinfoStaleSec = 10
	// SENSOR_READING_TYPE
	hwTemp, hwFan, hwPower, hwUsage = 1, 3, 5, 7
)

// hwinfoKeys maps the English labels of HWiNFO to the columns of the log sent
// to the site (the same as a HWiNFO sensors log, read by the Diag Atelier).
var hwinfoKeys = map[string]string{
	"Core Temperatures (avg)":         "cpuTempAvg",
	"Core Max":                        "cpuTempMax",
	"CPU (Tctl/Tdie)":                 "cpuTempMax",
	"CPU Package Power":               "cpuPower",
	"Core Thermal Throttling (avg)":   "throttleCore",
	"Package/Ring Thermal Throttling": "throttlePkg",
	"Drive Temperature":               "diskTemp",
}

// parseHWiNFO decodes HWiNFO_SENSORS_SHARED_MEM2 (packed structures).
func parseHWiNFO(mem []byte, now time.Time) []sensor {
	u32 := func(off int) uint32 {
		if off+4 > len(mem) {
			return 0
		}
		return binary.LittleEndian.Uint32(mem[off:])
	}
	f64 := func(off int) float64 {
		if off+8 > len(mem) {
			return 0
		}
		return math.Float64frombits(binary.LittleEndian.Uint64(mem[off:]))
	}
	str := func(off, n int) string {
		if off+n > len(mem) {
			return ""
		}
		b := mem[off : off+n]
		if i := strings.IndexByte(string(b), 0); i >= 0 {
			b = b[:i]
		}
		r := make([]rune, len(b)) // ANSI (Windows-1252) : « ° » est 0xB0, comme en Latin-1
		for i, c := range b {
			r[i] = rune(c)
		}
		return strings.TrimSpace(string(r))
	}
	if u32(0) != hwinfoSig {
		return nil
	}
	poll := int64(u32(12)) | int64(u32(16))<<32
	if poll > 0 && now.Unix()-poll > hwinfoStaleSec {
		return nil // HWiNFO fermé ou en pause : valeurs figées
	}
	sOff, sSize, sNum := int(u32(20)), int(u32(24)), int(u32(28))
	rOff, rSize, rNum := int(u32(32)), int(u32(36)), int(u32(40))
	if sSize < 264 || rSize < 316 || sNum > 512 || rNum > 8192 {
		return nil
	}
	sensors := make([]string, sNum)
	for i := range sensors {
		o := sOff + i*sSize
		if n := str(o+136, 128); n != "" { // nom choisi dans HWiNFO
			sensors[i] = n
		} else {
			sensors[i] = str(o+8, 128)
		}
	}
	var out []sensor
	for i := 0; i < rNum; i++ {
		o := rOff + i*rSize
		typ := u32(o)
		if typ != hwTemp && typ != hwFan && typ != hwPower && typ != hwUsage && !strings.Contains(str(o+12, 128), "Throttling") {
			continue
		}
		si := int(u32(o + 4))
		if si >= len(sensors) {
			continue
		}
		orig, label, unit, v := str(o+12, 128), str(o+140, 128), str(o+268, 16), f64(o+284)
		if label == "" {
			label = orig
		}
		out = append(out, sensor{ID: fmt.Sprintf("hw:%d:%d", si, u32(o+8)), G: "HWiNFO · " + sensors[si], L: label, U: unit, V: round2(v), K: hwinfoKeys[orig]})
	}
	return out
}
