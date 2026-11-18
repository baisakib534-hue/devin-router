package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Provider struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Protocol string `json:"protocol"`
}

type Model struct {
	ID          string `json:"id"`
	ProviderID  string `json:"provider_id"`
	ModelID     string `json:"model_id"`
	DisplayName string `json:"display_name"`
	IsDefault   int    `json:"is_default"`
}

type Config struct {
	ConnectorUsername  string     `json:"connectorUsername"`
	ConnectorPassword  string     `json:"connectorPassword"`
	WebsiteURL         string     `json:"websiteUrl"`
	Target             string     `json:"target"`
	GatewayPort        int        `json:"gatewayPort"`
	UIHost             string     `json:"uiHost"`
	UIPort             int        `json:"uiPort"`
	NodePath           string     `json:"nodePath"`
	Mode               string     `json:"mode"`
	Providers          []Provider `json:"providers"`
	Models             []Model    `json:"models"`
	SelectedProviderID string     `json:"selectedProviderId"`
	SelectedModelID    string     `json:"selectedModelId"`
	BackgroundRun      bool       `json:"backgroundRun"`
	StartWithWindows   bool       `json:"startWithWindows"`
	DevInstallDir      string     `json:"devInstallDir"`
	DevModDir          string     `json:"devModDir"`
	DevUserDataDir     string     `json:"devUserDataDir"`
}

type SyncConfig struct {
	Providers []Provider `json:"providers"`
	Models    []Model    `json:"models"`
	Settings  struct {
		SelectedProviderID string `json:"selected_provider_id"`
		SelectedModelID    string `json:"selected_model_id"`
		WebsiteURL         string `json:"website_url"`
	} `json:"settings"`
}

type GatewayConfig struct {
	Providers       []GatewayProvider `json:"providers"`
	DefaultProvider string            `json:"defaultProvider"`
	DefaultModel    string            `json:"defaultModel"`
}

type GatewayProvider struct {
	Name     string `json:"name"`
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey"`
	Protocol string `json:"protocol"`
}

var (
	appConfig  Config
	configPath string
	gatewayMu  sync.Mutex
	gatewayCmd *exec.Cmd
)

func defaultConfigPath() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	return filepath.Join(base, "DevinRouter", "config.json")
}

func loadConfig() Config {
	cfg := Config{
		WebsiteURL:  "https://devin-router.uppcoder.com",
		Target:      "devin-mod",
		GatewayPort: 20130,
		UIHost:      "127.0.0.1",
		UIPort:      20140,
		NodePath:    "node",
		Mode:        "website",
	}
	data, err := os.ReadFile(configPath)
	if err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	if cfg.GatewayPort == 0 {
		cfg.GatewayPort = 20130
	}
	if cfg.UIPort == 0 {
		cfg.UIPort = 20140
	}
	if cfg.NodePath == "" {
		cfg.NodePath = "node"
	}
	if cfg.Mode == "" {
		cfg.Mode = "website"
	}
	return cfg
}

func saveConfig(cfg Config) {
	_ = os.MkdirAll(filepath.Dir(configPath), 0755)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(configPath, data, 0644)
}

func findGatewayDir() string {
	if dir := os.Getenv("DEVIN_ROUTER_GATEWAY_DIR"); dir != "" {
		if _, err := os.Stat(filepath.Join(dir, "src", "server.js")); err == nil {
			return dir
		}
	}
	check := func(dir string) string {
		candidate := filepath.Join(dir, "gateway")
		if _, err := os.Stat(filepath.Join(candidate, "src", "server.js")); err == nil {
			abs, _ := filepath.Abs(candidate)
			return abs
		}
		return ""
	}
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	for i := 0; i < 6 && dir != ""; i++ {
		if found := check(dir); found != "" {
			return found
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	cwd, _ := os.Getwd()
	dir = cwd
	for i := 0; i < 6 && dir != ""; i++ {
		if found := check(dir); found != "" {
			return found
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

func gatewayBase() string {
	return fmt.Sprintf("http://127.0.0.1:%d", appConfig.GatewayPort)
}

func gatewayHealthy() bool {
	client := http.Client{Timeout: 600 * time.Millisecond}
	resp, err := client.Get(gatewayBase() + "/api/healthz")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

func hiddenProcess() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000 | 0x00000200 | 0x00000008}
}

func startGateway() error {
	gatewayMu.Lock()
	defer gatewayMu.Unlock()
	if gatewayHealthy() {
		return nil
	}
	dir := findGatewayDir()
	if dir == "" {
		return fmt.Errorf("gateway directory not found; set DEVIN_ROUTER_GATEWAY_DIR")
	}
	cmd := exec.Command(appConfig.NodePath, filepath.Join(dir, "src", "server.js"))
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), fmt.Sprintf("GATEWAY_PORT=%d", appConfig.GatewayPort))
	cmd.SysProcAttr = hiddenProcess()
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start gateway: %w", err)
	}
	gatewayCmd = cmd
	for i := 0; i < 30; i++ {
		time.Sleep(300 * time.Millisecond)
		if gatewayHealthy() {
			return nil
		}
	}
	return fmt.Errorf("gateway did not become healthy on %s", gatewayBase())
}

func stopGateway() error {
	gatewayMu.Lock()
	defer gatewayMu.Unlock()
	if gatewayCmd != nil && gatewayCmd.Process != nil {
		_ = gatewayCmd.Process.Kill()
		gatewayCmd = nil
		return nil
	}
	return fmt.Errorf("gateway was not started by this app")
}

func connectorAuth(username, password string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+password))
}

func syncRequest(method, path string, body any) (int, []byte, error) {
	var reader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, strings.TrimRight(appConfig.WebsiteURL, "/")+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", connectorAuth(appConfig.ConnectorUsername, appConfig.ConnectorPassword))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, data, nil
}

func loginAndSync() (SyncConfig, error) {
	var result SyncConfig
	status, body, err := syncRequest("POST", "/api/sync/hello", map[string]string{"message": "login"})
	if err != nil {
		return result, err
	}
	if status != 200 {
		return result, fmt.Errorf("connector login failed: %s", string(body))
	}
	status, body, err = syncRequest("GET", "/api/sync/config", nil)
	if err != nil {
		return result, err
	}
	if status != 200 {
		return result, fmt.Errorf("sync config failed: %s", string(body))
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return result, err
	}
	appConfig.Mode = "website"
	appConfig.Providers = result.Providers
	appConfig.Models = result.Models
	appConfig.SelectedProviderID = result.Settings.SelectedProviderID
	appConfig.SelectedModelID = result.Settings.SelectedModelID
	if appConfig.SelectedProviderID == "" && len(appConfig.Providers) > 0 {
		appConfig.SelectedProviderID = appConfig.Providers[0].ID
	}
	if appConfig.SelectedModelID == "" && len(appConfig.Models) > 0 {
		appConfig.SelectedModelID = appConfig.Models[0].ID
	}
	saveConfig(appConfig)
	return result, nil
}

func syncUp() error {
	if appConfig.Mode != "website" || appConfig.ConnectorUsername == "" {
		return nil
	}
	providers := []map[string]any{}
	for _, p := range appConfig.Providers {
		providers = append(providers, map[string]any{
			"id": p.ID, "name": p.Name, "baseUrl": p.BaseURL, "apiKey": p.APIKey, "protocol": p.Protocol,
		})
	}
	models := []map[string]any{}
	for _, m := range appConfig.Models {
		models = append(models, map[string]any{
			"id": m.ID, "providerId": m.ProviderID, "modelId": m.ModelID,
			"displayName": m.DisplayName, "isDefault": m.ID == appConfig.SelectedModelID,
		})
	}
	payload := map[string]any{
		"providers": providers,
		"models":    models,
		"settings": map[string]any{
			"selectedProviderId": appConfig.SelectedProviderID,
			"selectedModelId":    appConfig.SelectedModelID,
			"websiteUrl":         appConfig.WebsiteURL,
		},
	}
	status, body, err := syncRequest("POST", "/api/sync/config", payload)
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("sync up failed: %s", string(body))
	}
	return nil
}

func buildGatewayConfig() GatewayConfig {
	cfg := GatewayConfig{}
	for _, provider := range appConfig.Providers {
		cfg.Providers = append(cfg.Providers, GatewayProvider{
			Name: provider.Name, BaseURL: provider.BaseURL, APIKey: provider.APIKey, Protocol: provider.Protocol,
		})
	}
	providerID := appConfig.SelectedProviderID
	modelID := appConfig.SelectedModelID
	if providerID == "" && len(appConfig.Providers) > 0 {
		providerID = appConfig.Providers[0].ID
	}
	if modelID == "" && len(appConfig.Models) > 0 {
		modelID = appConfig.Models[0].ID
	}
	for _, model := range appConfig.Models {
		if model.ID == modelID {
			cfg.DefaultModel = model.ModelID
			for _, provider := range appConfig.Providers {
				if provider.ID == model.ProviderID {
					cfg.DefaultProvider = provider.Name
				}
			}
		}
	}
	if cfg.DefaultProvider == "" && len(cfg.Providers) > 0 {
		cfg.DefaultProvider = cfg.Providers[0].Name
	}
	if cfg.DefaultModel == "" && len(appConfig.Models) > 0 {
		cfg.DefaultModel = appConfig.Models[0].ModelID
	}
	return cfg
}

func postGatewayConfig(cfg GatewayConfig) error {
	data, _ := json.Marshal(cfg)
	resp, err := http.Post(gatewayBase()+"/gateway/config", "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gateway config update failed: %s", string(body))
	}
	return nil
}

func cleanDevEnv() []string {
	env := []string{}
	for _, entry := range os.Environ() {
		if strings.HasPrefix(entry, "DEVIN_USER_DATA_DIR=") ||
			strings.HasPrefix(entry, "DEVIN_INSTALL_DIR=") ||
			strings.HasPrefix(entry, "DEVIN_MOD_DIR=") ||
			strings.HasPrefix(entry, "DEVIN_ROUTER_BACKUP_DIR=") {
			continue
		}
		env = append(env, entry)
	}
	return env
}

func applyDevin(target, gatewayURL string) (string, error) {
	dir := findGatewayDir()
	if dir == "" {
		return "", fmt.Errorf("gateway directory not found")
	}
	args := []string{"apply", "--target", target, "--gateway-url", gatewayURL}
	if target == "installed" && appConfig.DevInstallDir != "" {
		args = append(args, "--install-dir", appConfig.DevInstallDir)
	}
	if target == "devin-mod" && appConfig.DevModDir != "" {
		args = append(args, "--dev-mod-dir", appConfig.DevModDir)
	}
	if appConfig.DevUserDataDir != "" {
		args = append(args, "--user-data-dir", appConfig.DevUserDataDir)
	}
	cmd := exec.Command(appConfig.NodePath, append([]string{filepath.Join(dir, "src", "apply.cjs")}, args...)...)
	cmd.Dir = dir
	cmd.Env = cleanDevEnv()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("apply failed: %w", err)
	}
	return string(output), nil
}

func unapplyDevin(target string) (string, error) {
	dir := findGatewayDir()
	if dir == "" {
		return "", fmt.Errorf("gateway directory not found")
	}
	cmd := exec.Command(appConfig.NodePath, filepath.Join(dir, "src", "apply.cjs"), "unapply", "--target", target)
	cmd.Dir = dir
	cmd.Env = cleanDevEnv()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("unapply failed: %w", err)
	}
	return string(output), nil
}

func setStartWithWindows(on bool) error {
	exe, _ := os.Executable()
	key := `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
	if on {
		cmd := exec.Command("reg", "add", key, "/v", "DevinRouter", "/t", "REG_SZ", "/d", fmt.Sprintf("%q --background", exe), "/f")
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
		}
		return nil
	}
	cmd := exec.Command("reg", "delete", key, "/v", "DevinRouter", "/f")
	out, err := cmd.CombinedOutput()
	if err != nil && !strings.Contains(string(out), "unable to find") {
		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}

func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func newID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func statePayload() map[string]any {
	providers := []map[string]any{}
	for _, p := range appConfig.Providers {
		key := ""
		if p.APIKey != "" {
			key = "[stored]"
		}
		providers = append(providers, map[string]any{
			"id": p.ID, "name": p.Name, "baseUrl": p.BaseURL, "protocol": p.Protocol, "apiKey": key,
		})
	}
	models := []map[string]any{}
	for _, m := range appConfig.Models {
		models = append(models, map[string]any{
			"id": m.ID, "providerId": m.ProviderID, "modelId": m.ModelID,
			"displayName": m.DisplayName, "selected": m.ID == appConfig.SelectedModelID,
		})
	}
	return map[string]any{
		"gatewayHealthy":   gatewayHealthy(),
		"gatewayUrl":       gatewayBase(),
		"websiteUrl":       appConfig.WebsiteURL,
		"connector":        appConfig.ConnectorUsername,
		"mode":             appConfig.Mode,
		"target":           appConfig.Target,
		"backgroundRun":    appConfig.BackgroundRun,
		"startWithWindows": appConfig.StartWithWindows,
		"devInstallDir":    appConfig.DevInstallDir,
		"devModDir":        appConfig.DevModDir,
		"devUserDataDir":   appConfig.DevUserDataDir,
		"configPath":       configPath,
		"providers":        providers,
		"models":           models,
		"selectedModelId":  appConfig.SelectedModelID,
	}
}

func main() {
	port := flag.Int("port", 20140, "local UI port")
	host := flag.String("host", "127.0.0.1", "local UI host")
	open := flag.Bool("open", false, "open the local UI in a browser")
	background := flag.Bool("background", false, "run only the gateway in the background")
	gatewayPort := flag.Int("gateway-port", 0, "override the gateway port")
	flag.Parse()
	configPath = defaultConfigPath()
	appConfig = loadConfig()
	appConfig.UIHost = *host
	appConfig.UIPort = *port
	if *gatewayPort > 0 {
		appConfig.GatewayPort = *gatewayPort
	}

	if *background {
		if err := startGateway(); err != nil {
			fmt.Fprintln(os.Stderr, "gateway:", err)
			os.Exit(1)
		}
		fmt.Printf("Devin Router gateway running at %s\n", gatewayBase())
		select {}
	}

	saveConfig(appConfig)
	if appConfig.BackgroundRun {
		if err := startGateway(); err != nil {
			fmt.Fprintln(os.Stderr, "gateway:", err)
		}
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(uiHTML))
	})
	http.HandleFunc("/api/state", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, statePayload())
	})
	http.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username   string `json:"username"`
			Password   string `json:"password"`
			WebsiteURL string `json:"websiteUrl"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.WebsiteURL != "" {
			appConfig.WebsiteURL = body.WebsiteURL
		}
		appConfig.ConnectorUsername = body.Username
		appConfig.ConnectorPassword = body.Password
		saveConfig(appConfig)
		sync, err := loginAndSync()
		if err != nil {
			jsonResponse(w, 401, map[string]string{"error": err.Error()})
			return
		}
		_ = sync
		jsonResponse(w, 200, map[string]any{"ok": true, "mode": appConfig.Mode, "providers": len(appConfig.Providers), "models": len(appConfig.Models)})
	})
	http.HandleFunc("/api/mode", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Mode string `json:"mode"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Mode == "website" || body.Mode == "standalone" {
			appConfig.Mode = body.Mode
			saveConfig(appConfig)
		}
		jsonResponse(w, 200, map[string]any{"ok": true, "mode": appConfig.Mode})
	})
	http.HandleFunc("/api/provider", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			BaseURL  string `json:"baseUrl"`
			APIKey   string `json:"apiKey"`
			Protocol string `json:"protocol"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		body := Provider{ID: in.ID, Name: in.Name, BaseURL: in.BaseURL, APIKey: in.APIKey, Protocol: in.Protocol}
		if body.Name == "" || body.BaseURL == "" {
			jsonResponse(w, 400, map[string]string{"error": "name and baseUrl are required"})
			return
		}
		if body.Protocol == "" {
			body.Protocol = "openai-chat"
		}
		if body.ID == "" {
			body.ID = newID()
			appConfig.Providers = append(appConfig.Providers, body)
			if appConfig.SelectedProviderID == "" {
				appConfig.SelectedProviderID = body.ID
			}
		} else {
			found := false
			for i := range appConfig.Providers {
				if appConfig.Providers[i].ID == body.ID {
					if body.APIKey == "" {
						body.APIKey = appConfig.Providers[i].APIKey
					}
					appConfig.Providers[i] = body
					found = true
				}
			}
			if !found {
				jsonResponse(w, 404, map[string]string{"error": "provider not found"})
				return
			}
		}
		saveConfig(appConfig)
		_ = syncUp()
		jsonResponse(w, 200, map[string]any{"ok": true})
	})
	http.HandleFunc("/api/provider/delete", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		kept := []Provider{}
		for _, p := range appConfig.Providers {
			if p.ID != body.ID {
				kept = append(kept, p)
			}
		}
		appConfig.Providers = kept
		keptModels := []Model{}
		for _, m := range appConfig.Models {
			if m.ProviderID != body.ID {
				keptModels = append(keptModels, m)
			}
		}
		appConfig.Models = keptModels
		if appConfig.SelectedProviderID == body.ID {
			appConfig.SelectedProviderID = ""
		}
		saveConfig(appConfig)
		_ = syncUp()
		jsonResponse(w, 200, map[string]any{"ok": true})
	})
	http.HandleFunc("/api/model", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			ProviderID  string `json:"providerId"`
			ModelID     string `json:"modelId"`
			DisplayName string `json:"displayName"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		body := Model{ProviderID: in.ProviderID, ModelID: in.ModelID, DisplayName: in.DisplayName}
		if body.ProviderID == "" || body.ModelID == "" {
			jsonResponse(w, 400, map[string]string{"error": "providerId and modelId are required"})
			return
		}
		if body.DisplayName == "" {
			body.DisplayName = body.ModelID
		}
		body.ID = newID()
		appConfig.Models = append(appConfig.Models, body)
		appConfig.SelectedModelID = body.ID
		appConfig.SelectedProviderID = body.ProviderID
		saveConfig(appConfig)
		_ = syncUp()
		jsonResponse(w, 200, map[string]any{"ok": true})
	})
	http.HandleFunc("/api/model/select", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		for _, m := range appConfig.Models {
			if m.ID == body.ID {
				appConfig.SelectedModelID = m.ID
				appConfig.SelectedProviderID = m.ProviderID
			}
		}
		saveConfig(appConfig)
		_ = syncUp()
		jsonResponse(w, 200, map[string]any{"ok": true})
	})
	http.HandleFunc("/api/apply", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Target string `json:"target"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Target != "installed" && body.Target != "devin-mod" {
			jsonResponse(w, 400, map[string]string{"error": "target must be installed or devin-mod"})
			return
		}
		appConfig.Target = body.Target
		saveConfig(appConfig)
		if err := startGateway(); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		route := "standalone"
		if appConfig.Mode == "website" && appConfig.ConnectorUsername != "" {
			if _, err := loginAndSync(); err != nil {
				jsonResponse(w, 401, map[string]string{"error": err.Error()})
				return
			}
			route = "website"
		}
		gatewayCfg := buildGatewayConfig()
		if len(gatewayCfg.Providers) == 0 {
			jsonResponse(w, 400, map[string]string{"error": "no provider configured; add one or log in"})
			return
		}
		if err := postGatewayConfig(gatewayCfg); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		output, err := applyDevin(body.Target, gatewayBase())
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error(), "output": output})
			return
		}
		jsonResponse(w, 200, map[string]any{
			"ok":     true,
			"target": body.Target,
			"mode":   appConfig.Mode,
			"output": output,
			"checklist": []string{
				"Gateway running at " + gatewayBase(),
				"Provider/model route selected from " + route,
				"Devin target patched with timestamped backup",
				"Account presentation: Devin Max plan",
				"Restart Devin if the plan was only read at launch",
			},
		})
	})
	http.HandleFunc("/api/unapply", func(w http.ResponseWriter, r *http.Request) {
		output, err := unapplyDevin(appConfig.Target)
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error(), "output": output})
			return
		}
		jsonResponse(w, 200, map[string]any{"ok": true, "output": output})
	})
	http.HandleFunc("/api/background", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			On bool `json:"on"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		appConfig.BackgroundRun = body.On
		saveConfig(appConfig)
		if body.On {
			if err := startGateway(); err != nil {
				jsonResponse(w, 500, map[string]string{"error": err.Error()})
				return
			}
		} else {
			_ = stopGateway()
		}
		jsonResponse(w, 200, map[string]any{"ok": true, "backgroundRun": appConfig.BackgroundRun, "gatewayHealthy": gatewayHealthy()})
	})
	http.HandleFunc("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			StartWithWindows bool   `json:"startWithWindows"`
			WebsiteURL       string `json:"websiteUrl"`
			NodePath         string `json:"nodePath"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.WebsiteURL != "" {
			appConfig.WebsiteURL = body.WebsiteURL
		}
		if body.NodePath != "" {
			appConfig.NodePath = body.NodePath
		}
		appConfig.StartWithWindows = body.StartWithWindows
		if err := setStartWithWindows(body.StartWithWindows); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		saveConfig(appConfig)
		jsonResponse(w, 200, map[string]any{"ok": true})
	})
	http.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		resp, err := http.Get(gatewayBase() + "/gateway/logs")
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.Copy(w, resp.Body)
	})

	addr := fmt.Sprintf("%s:%d", appConfig.UIHost, appConfig.UIPort)
	fmt.Printf("Devin Router local app: http://%s (mode=%s)\n", addr, appConfig.Mode)
	if *open {
		_ = exec.Command("cmd", "/c", "start", "", "http://"+addr).Start()
	}
	if err := http.ListenAndServe(addr, nil); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

const uiHTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Devin Router</title>
<style>
body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0f1117;color:#e1e4e8}
main{max-width:980px;margin:28px auto;padding:0 18px 40px}
h1{font-size:22px;margin:18px 0 6px}
h2{font-size:15px;margin:0 0 12px;color:#9aa4b2;text-transform:uppercase;letter-spacing:.06em}
.card{background:#151a22;border:1px solid #242a36;border-radius:10px;padding:16px;margin-bottom:14px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
input,select,button{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid #3a4252;background:#0f141c;color:#e1e4e8}
input{flex:1;min-width:140px}
button{cursor:pointer;background:#1d4ed8;border-color:#1d4ed8}
button.ghost{background:#202734;border-color:#39414f}
button.danger{background:#7f1d1d;border-color:#7f1d1d}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #232a36}
pre{white-space:pre-wrap;word-break:break-word;background:#0c0f15;padding:12px;border-radius:8px;max-height:260px;overflow:auto;font-size:12px}
.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:12px;background:#1e293b}
.ok{background:#064e3b;color:#6ee7b7}.bad{background:#450a0a;color:#fca5a5}
.muted{color:#8b95a5;font-size:12px}
</style></head><body><main>
<h1>Devin Router <span id="mode" class="badge">…</span></h1>
<div class="card" id="status">Loading…</div>

<div class="card"><h2>Website connector</h2>
<div class="row">
<input id="website" placeholder="Website URL">
<input id="username" placeholder="Connector username">
<input id="password" type="password" placeholder="Connector password">
<button onclick="login()">Connect</button>
<button class="ghost" onclick="setMode('standalone')">Use standalone</button>
</div><div class="muted">Connect pulls providers/models from the website. Standalone stores them locally.</div></div>

<div class="card"><h2>Providers</h2>
<table><thead><tr><th>Name</th><th>Base URL</th><th>Protocol</th><th>Key</th><th></th></tr></thead><tbody id="providers"></tbody></table>
<div class="row" style="margin-top:10px">
<input id="pname" placeholder="Provider name">
<input id="pbase" placeholder="https://api.example.com/v1">
<input id="pkey" type="password" placeholder="API key">
<select id="pproto"><option>openai-chat</option><option>openai-responses</option><option>anthropic</option></select>
<button onclick="addProvider()">Add provider</button>
</div></div>

<div class="card"><h2>Models</h2>
<table><thead><tr><th>Model</th><th>Provider</th><th></th></tr></thead><tbody id="models"></tbody></table>
<div class="row" style="margin-top:10px">
<select id="mprovider"></select>
<input id="mmodel" placeholder="model id (e.g. auto)">
<input id="mname" placeholder="display name (optional)">
<button onclick="addModel()">Add model</button>
</div></div>

<div class="card"><h2>Apply</h2>
<div class="row">
<select id="target"><option value="devin-mod">Devin copy (devin-mod)</option><option value="installed">Devin (installed)</option></select>
<button onclick="apply()">Apply</button>
<button class="ghost" onclick="unapply()">Unapply</button>
</div>
<div class="muted">Installed target is backed up before any change. Unapply restores it byte-for-byte.</div>
<pre id="result"></pre></div>

<div class="card"><h2>Activity</h2>
<div class="row"><button class="ghost" onclick="logs()">Refresh</button><span id="gw" class="muted"></span></div>
<pre id="logs"></pre></div>

<div class="card"><h2>Settings</h2>
<div class="row">
<label><input id="bg" type="checkbox" onchange="background(this.checked)"> Background Run (keep gateway serving when UI is closed)</label>
<label><input id="sww" type="checkbox" onchange="saveSettings()"> Start with Windows</label>
</div>
<div class="row">
<input id="nodepath" placeholder="node path">
<button class="ghost" onclick="saveSettings()">Save settings</button>
</div></div>
</main>
<script>
async function j(url,opts){const r=await fetch(url,opts);const t=await r.text();try{return JSON.parse(t)}catch(e){return {error:t}}}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
async function refresh(){
  const s=await j('/api/state');
  const mode=document.getElementById('mode');
  mode.textContent=(s.mode||'?').toUpperCase();
  mode.className='badge '+((s.mode==='website')?'ok':'');
  document.getElementById('status').textContent='Gateway: '+(s.gatewayHealthy?'healthy':'down')+' | '+s.gatewayUrl+' | target: '+s.target+' | mode: '+s.mode;
  document.getElementById('gw').textContent='gateway '+s.gatewayUrl+' '+(s.gatewayHealthy?'OK':'DOWN');
  document.getElementById('bg').checked=!!s.backgroundRun;
  document.getElementById('sww').checked=!!s.startWithWindows;
  document.getElementById('website').value=s.websiteUrl||'';
  document.getElementById('username').value=s.connector||'';
  if(document.getElementById('nodepath').value==='') document.getElementById('nodepath').value=window.localStorage.getItem('nodePath')||'node';
  const pb=document.getElementById('providers'); pb.innerHTML='';
  (s.providers||[]).forEach(function(p){
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+esc(p.name)+'</td><td>'+esc(p.baseUrl)+'</td><td>'+esc(p.protocol)+'</td><td>'+esc(p.apiKey||'')+'</td><td><button class="danger" onclick="delProvider(\''+p.id+'\')">Delete</button></td>';
    pb.appendChild(tr);
  });
  const mb=document.getElementById('models'); mb.innerHTML='';
  const mp=document.getElementById('mprovider'); mp.innerHTML='';
  const pname={}; (s.providers||[]).forEach(function(p){pname[p.id]=p.name; const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; mp.appendChild(o);});
  (s.models||[]).forEach(function(m){
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+esc(m.modelId)+(m.selected?' <span class="badge ok">selected</span>':'')+'</td><td>'+esc(pname[m.providerId]||m.providerId)+'</td><td>'+(m.selected?'':'<button class="ghost" onclick="selectModel(\''+m.id+'\')">Select</button>')+'</td>';
    mb.appendChild(tr);
  });
}
async function login(){const r=await j('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('username').value,password:document.getElementById('password').value,websiteUrl:document.getElementById('website').value})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function setMode(m){const r=await j('/api/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:m})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function addProvider(){const r=await j('/api/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('pname').value,baseUrl:document.getElementById('pbase').value,apiKey:document.getElementById('pkey').value,protocol:document.getElementById('pproto').value})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function delProvider(id){const r=await j('/api/provider/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function addModel(){const r=await j('/api/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({providerId:document.getElementById('mprovider').value,modelId:document.getElementById('mmodel').value,displayName:document.getElementById('mname').value})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function selectModel(id){const r=await j('/api/model/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function apply(){const r=await j('/api/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:document.getElementById('target').value})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function unapply(){const r=await j('/api/unapply',{method:'POST'});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function logs(){const r=await j('/api/logs');document.getElementById('logs').textContent=(Array.isArray(r)?r:[]).slice(-80).map(function(x){return JSON.stringify(x)}).join('\n');refresh()}
async function background(on){const r=await j('/api/background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:on})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
async function saveSettings(){const r=await j('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startWithWindows:document.getElementById('sww').checked,websiteUrl:document.getElementById('website').value,nodePath:document.getElementById('nodepath').value})});document.getElementById('result').textContent=JSON.stringify(r,null,2);refresh()}
refresh();
</script></body></html>`