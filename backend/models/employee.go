package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Employee struct {
	ID         uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID uuid.UUID      `gorm:"type:uuid;not null;index:idx_employees_business_branch" json:"business_id"`
	BranchID   uuid.UUID      `gorm:"type:uuid;not null;index:idx_employees_business_branch" json:"branch_id"`
	Name       string         `gorm:"type:varchar(255);not null" json:"name"`
	Email      string         `gorm:"type:varchar(100);not null" json:"email"`
	Phone      string         `gorm:"type:varchar(20);not null" json:"phone"`
	Role       string         `gorm:"type:varchar(100);not null" json:"role"`
	Status     string         `gorm:"type:varchar(30);not null;default:'Aktif'" json:"status"`
	Shift      string         `gorm:"type:varchar(100);not null;default:''" json:"shift"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type EmployeeAttendance struct {
	ID                uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BusinessID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"branch_id"`
	EmployeeID        uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_employee_attendance_day" json:"employee_id"`
	AttendanceDate    time.Time  `gorm:"type:date;not null;uniqueIndex:idx_employee_attendance_day" json:"attendance_date"`
	ClockIn           *time.Time `json:"clock_in"`
	ClockOut          *time.Time `json:"clock_out"`
	ClockInLatitude   *float64   `gorm:"type:double precision" json:"clock_in_latitude"`
	ClockInLongitude  *float64   `gorm:"type:double precision" json:"clock_in_longitude"`
	ClockInAccuracyM  *float64   `gorm:"type:double precision" json:"clock_in_accuracy_m"`
	ClockOutLatitude  *float64   `gorm:"type:double precision" json:"clock_out_latitude"`
	ClockOutLongitude *float64   `gorm:"type:double precision" json:"clock_out_longitude"`
	ClockOutAccuracyM *float64   `gorm:"type:double precision" json:"clock_out_accuracy_m"`
	Status            string     `gorm:"type:varchar(30);not null" json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Employee          Employee   `gorm:"foreignKey:EmployeeID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}
