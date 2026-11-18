package main

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

//go:embed all:assets
var assets embed.FS

func main() {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	dest := filepath.Join(base, "DevinRouter")
	fmt.Println("Devin Router setup")
	fmt.Println("Installing to:", dest)

	err := fs.WalkDir(assets, "assets", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel := strings.TrimPrefix(path, "assets")
		rel = strings.TrimPrefix(rel, "/")
		target := filepath.Join(dest, filepath.FromSlash(rel))
		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		data, readErr := assets.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if mkErr := os.MkdirAll(filepath.Dir(target), 0755); mkErr != nil {
			return mkErr
		}
		return os.WriteFile(target, data, 0644)
	})
	if err != nil {
		fmt.Println("Install failed:", err)
		os.Exit(1)
	}

	exe := filepath.Join(dest, "devin-router-local.exe")
	ps := fmt.Sprintf(`$s=(New-Object -ComObject WScript.Shell).CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Devin Router.lnk");$s.TargetPath=%q;$s.WorkingDirectory=%q;$s.Save()`, exe, dest)
	_ = exec.Command("powershell", "-NoProfile", "-Command", ps).Run()

	runValue := fmt.Sprintf("%q --background", exe)
	_ = exec.Command("reg", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "DevinRouter", "/t", "REG_SZ", "/d", runValue, "/f").Run()

	if _, err := exec.LookPath("node"); err != nil {
		fmt.Println("WARNING: Node.js was not found on PATH. The gateway needs Node 20+.")
		fmt.Println("Install Node.js, then restart Devin Router.")
	}

	fmt.Println("Installed.")
	fmt.Println("Start menu shortcut: Devin Router")
}