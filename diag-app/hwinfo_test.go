package main

import (
	"encoding/binary"
	"math"
	"testing"
	"time"
)

// buildHWiNFO writes a HWiNFO_SENSORS_SHARED_MEM2 block with one sensor and the given readings.
func buildHWiNFO(poll int64, readings [][4]any) []byte {
	const hdr, sSize, rSize = 44, 264, 316
	mem := make([]byte, hdr+sSize+len(readings)*rSize)
	le := binary.LittleEndian
	le.PutUint32(mem[0:], 0x53695748)
	le.PutUint64(mem[12:], uint64(poll))
	le.PutUint32(mem[20:], hdr)
	le.PutUint32(mem[24:], sSize)
	le.PutUint32(mem[28:], 1)
	le.PutUint32(mem[32:], hdr+sSize)
	le.PutUint32(mem[36:], rSize)
	le.PutUint32(mem[40:], uint32(len(readings)))
	copy(mem[hdr+8:], "CPU [#0]: Intel Core i5-8250U: DTS")
	for i, r := range readings {
		o := hdr + sSize + i*rSize
		le.PutUint32(mem[o:], r[0].(uint32))
		le.PutUint32(mem[o+8:], uint32(i))
		copy(mem[o+12:], r[1].(string))
		copy(mem[o+268:], r[2].(string))
		le.PutUint64(mem[o+284:], math.Float64bits(r[3].(float64)))
	}
	return mem
}

func TestParseHWiNFO(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	mem := buildHWiNFO(now.Unix()-1, [][4]any{
		{uint32(1), "Core Max", "\xb0C", 71.5},
		{uint32(2), "Vcore", "V", 1.1}, // tension : ignorée
		{uint32(8), "Core Thermal Throttling (avg)", "Yes/No", 1.0},
	})
	got := parseHWiNFO(mem, now)
	if len(got) != 2 {
		t.Fatalf("got %d readings, want 2: %+v", len(got), got)
	}
	if got[0].L != "Core Max" || got[0].U != "°C" || got[0].V != 71.5 || got[0].K != "cpuTempMax" || got[0].G != "HWiNFO · CPU [#0]: Intel Core i5-8250U: DTS" {
		t.Errorf("temperature: %+v", got[0])
	}
	if got[1].K != "throttleCore" || got[1].V != 1 {
		t.Errorf("throttling: %+v", got[1])
	}
	if parseHWiNFO(mem, now.Add(time.Minute)) != nil {
		t.Error("stale values must be ignored")
	}
	mem[0] = 0
	if parseHWiNFO(mem, now) != nil {
		t.Error("bad signature must be ignored")
	}
}
