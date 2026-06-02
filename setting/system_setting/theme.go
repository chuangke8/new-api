package system_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type ThemeSettings struct {
	Frontend      string `json:"frontend"`
	Mode          string `json:"mode"`
	Preset        string `json:"preset"`
	Font          string `json:"font"`
	Radius        string `json:"radius"`
	Scale         string `json:"scale"`
	ContentLayout string `json:"content_layout"`
}

var themeSettings = ThemeSettings{
	Frontend:      "classic",
	Mode:          "system",
	Preset:        "default",
	Font:          "default",
	Radius:        "default",
	Scale:         "default",
	ContentLayout: "full",
}

func init() {
	config.GlobalConfig.Register("theme", &themeSettings)
	syncThemeToCommon()
}

func syncThemeToCommon() {
	common.SetTheme(themeSettings.Frontend)
}

func GetThemeSettings() *ThemeSettings {
	return &themeSettings
}

// UpdateAndSyncTheme syncs the theme config to common after DB load.
func UpdateAndSyncTheme() {
	syncThemeToCommon()
}
