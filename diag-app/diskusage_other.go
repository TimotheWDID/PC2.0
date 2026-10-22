//go:build !windows

package main

import "io/fs"

func duIsLinkDir(e fs.DirEntry) bool { return e.Type()&fs.ModeSymlink != 0 }

func duOnlineOnly(fs.FileInfo) bool { return false }
