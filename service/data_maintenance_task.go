package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

var dataMaintenanceTaskOnce sync.Once

func StartDataMaintenanceCleanupTask() {
	dataMaintenanceTaskOnce.Do(func() {
		go func() {
			logger.LogInfo(context.Background(), "data maintenance cleanup task started")
			for {
				settings := model.GetDataMaintenanceSettings()
				interval := settings.CleanupIntervalHours
				if interval <= 0 {
					interval = 24
				}
				time.Sleep(time.Duration(interval) * time.Hour)
				logger.LogInfo(context.Background(), fmt.Sprintf("data maintenance cleanup task running: interval=%dh", interval))
				model.RunAutomaticDataMaintenanceCleanup()
			}
		}()
	})
}
