// RainKeys.scr: Windows 화면보호기 런처.
// Windows가 이 파일을 /s(실행) /c(설정) /p(미리보기) 인자로 부르면 함께 설치된 RainKeys.exe(Electron 앱)를 알맞은 모드로 띄움.
// 앱 본체(약 100MB)를 .scr로 복사하지 않으려고 따로 둔 작은 실행 파일.
// /install 은 이 파일을 현재 사용자의 화면보호기로 등록함(관리자 권한 필요 없음).
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func main() {
	arg := "/c" // 인자 없이 열면(탐색기에서 '구성') 설정으로 취급
	if len(os.Args) > 1 {
		arg = strings.ToLower(os.Args[1])
	}
	switch {
	case strings.HasPrefix(arg, "/s"):
		run("--saver", true)
	case strings.HasPrefix(arg, "/p"):
		// 설정 창의 작은 미리보기는 아직 그리지 않음
	case arg == "/install":
		if err := install(); err != nil {
			os.Exit(1)
		}
	default: // /c, /c:HWND
		run("--settings", false)
	}
}

// 설치본에서는 resources\RainKeys.scr 의 한 단계 위에 RainKeys.exe 가 있음
func appExe() string {
	self, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(self)
	for _, d := range []string{dir, filepath.Dir(dir)} {
		p := filepath.Join(d, "RainKeys.exe")
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func run(flag string, wait bool) {
	exe := appExe()
	if exe == "" {
		return
	}
	cmd := exec.Command(exe, flag)
	if err := cmd.Start(); err != nil {
		return
	}
	if wait {
		cmd.Wait() // Windows는 이 프로세스가 살아 있는 동안을 '화면보호기 실행 중'으로 봄
	}
}

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")
	spi      = user32.NewProc("SystemParametersInfoW")
	regSet   = advapi32.NewProc("RegSetKeyValueW")
)

const (
	hkeyCurrentUser         = 0x80000001
	regSz                   = 1
	spiGetScreenSaveTimeout = 0x000E
	spiSetScreenSaveTimeout = 0x000F
	spiSetScreenSaveActive  = 0x0011
	spifUpdateAndSend       = 0x01 | 0x02 // 레지스트리에 저장하고 다른 프로그램에 알림
)

func install() error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	// 화면보호기 경로는 공백 문제를 피하려고 짧은 이름(8.3)으로 저장
	path := self
	if long, err := syscall.UTF16PtrFromString(self); err == nil {
		buf := make([]uint16, 520)
		if n, err := syscall.GetShortPathName(long, &buf[0], uint32(len(buf))); err == nil && n > 0 && int(n) < len(buf) {
			path = syscall.UTF16ToString(buf[:n])
		}
	}
	key, _ := syscall.UTF16PtrFromString(`Control Panel\Desktop`)
	name, _ := syscall.UTF16PtrFromString("SCRNSAVE.EXE")
	val, _ := syscall.UTF16FromString(path)
	if r, _, _ := regSet.Call(hkeyCurrentUser, uintptr(unsafe.Pointer(key)), uintptr(unsafe.Pointer(name)), regSz,
		uintptr(unsafe.Pointer(&val[0])), uintptr(len(val)*2)); r != 0 {
		return syscall.Errno(r)
	}
	// 대기 시간이 정해져 있지 않으면 10분으로
	var timeout uint32
	spi.Call(spiGetScreenSaveTimeout, 0, uintptr(unsafe.Pointer(&timeout)), 0)
	if timeout == 0 {
		spi.Call(spiSetScreenSaveTimeout, 600, 0, spifUpdateAndSend)
	}
	if r, _, e := spi.Call(spiSetScreenSaveActive, 1, 0, spifUpdateAndSend); r == 0 {
		return e
	}
	return nil
}
