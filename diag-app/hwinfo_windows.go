//go:build windows

package main

import (
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Capteurs de HWiNFO : quand HWiNFO (la version portable de la clé suffit)
// tourne avec « Shared Memory Support », il publie tous ses relevés dans une
// mémoire partagée. PC2 Diag la lit : températures du processeur par cœur,
// consommation, ventilateurs… que Windows ne donne pas sans pilote.

var (
	procOpenFileMapping = windows.NewLazySystemDLL("kernel32.dll").NewProc("OpenFileMappingW")
	procRtlMoveMemory   = windows.NewLazySystemDLL("kernel32.dll").NewProc("RtlMoveMemory")
)

// readHWiNFO returns the readings HWiNFO publishes, or nil when it is not running.
func readHWiNFO() []sensor {
	name, _ := windows.UTF16PtrFromString(hwinfoSM)
	h, _, _ := procOpenFileMapping.Call(windows.FILE_MAP_READ, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return nil
	}
	defer windows.CloseHandle(windows.Handle(h))
	addr, err := windows.MapViewOfFile(windows.Handle(h), windows.FILE_MAP_READ, 0, 0, 0)
	if err != nil || addr == 0 {
		return nil
	}
	defer windows.UnmapViewOfFile(addr)
	var mbi windows.MemoryBasicInformation
	if windows.VirtualQuery(addr, &mbi, unsafe.Sizeof(mbi)) != nil || mbi.RegionSize < 44 {
		return nil
	}
	// copie : un instantané cohérent, et rien ne pointe dans la vue après sa fermeture
	mem := make([]byte, mbi.RegionSize)
	procRtlMoveMemory.Call(uintptr(unsafe.Pointer(&mem[0])), addr, mbi.RegionSize)
	return parseHWiNFO(mem, time.Now())
}
