package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errEmployeeRequiredFields = errors.New("Nama, email, nomor telepon, dan peran wajib diisi.")
	errEmployeeStatusInvalid  = errors.New("Status pegawai tidak valid.")

	errEmployeeNotFound    = errors.New("pegawai tidak ditemukan")
	errEmployeeInactive    = errors.New("pegawai tidak berstatus aktif")
	errEmployeeUnscheduled = errors.New("pegawai tidak memiliki jadwal hari ini")
	errAlreadyClockedIn    = errors.New("pegawai sudah clock-in hari ini")
	errNotClockedIn        = errors.New("pegawai belum clock-in hari ini")
	errAlreadyClockedOut   = errors.New("pegawai sudah clock-out hari ini")
)

var jakartaLocation = time.FixedZone("WIB", 7*60*60)

type employeeInput struct {
	Name   string `json:"name" binding:"required,max=255"`
	Email  string `json:"email" binding:"required,email,max=100"`
	Phone  string `json:"phone" binding:"required,max=20"`
	Role   string `json:"role" binding:"required,max=100"`
	Status string `json:"status" binding:"required"`
	Shift  string `json:"shift" binding:"max=100"`
}

type employeeResponse struct {
	models.Employee
	AttendanceStatus string     `json:"attendance_status"`
	ClockIn          *time.Time `json:"clock_in"`
	ClockOut         *time.Time `json:"clock_out"`
}

func GetEmployees(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	branchID, ok := employeeBranchID(c)
	if !ok {
		return
	}

	var employees []models.Employee
	if err := config.DB.Where("business_id = ? AND branch_id = ?", businessID, branchID).
		Order("created_at DESC").Find(&employees).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat data pegawai.")
		return
	}

	today := jakartaDate(time.Now())
	var attendanceRecords []models.EmployeeAttendance
	if err := config.DB.Where("business_id = ? AND branch_id = ? AND attendance_date = ?", businessID, branchID, today).
		Find(&attendanceRecords).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat kehadiran hari ini.")
		return
	}
	attendanceByEmployee := make(map[uuid.UUID]models.EmployeeAttendance, len(attendanceRecords))
	for _, record := range attendanceRecords {
		attendanceByEmployee[record.EmployeeID] = record
	}

	data := make([]employeeResponse, 0, len(employees))
	for _, employee := range employees {
		response := employeeResponse{Employee: employee, AttendanceStatus: "Belum masuk"}
		if attendance, exists := attendanceByEmployee[employee.ID]; exists {
			response.AttendanceStatus = attendance.Status
			response.ClockIn = attendance.ClockIn
			response.ClockOut = attendance.ClockOut
		}
		data = append(data, response)
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func CreateEmployee(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	branchID, ok := employeeBranchID(c)
	if !ok {
		return
	}

	var input employeeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if err := input.normalizeAndValidate(); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	employee := models.Employee{
		BusinessID: businessID,
		BranchID:   branchID,
		Name:       input.Name,
		Email:      input.Email,
		Phone:      input.Phone,
		Role:       input.Role,
		Status:     input.Status,
		Shift:      input.Shift,
	}
	if err := config.DB.Create(&employee).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menyimpan data pegawai.")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"employee": employeeToResponse(employee, nil)})
}

func UpdateEmployee(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	branchID, ok := employeeBranchID(c)
	if !ok {
		return
	}
	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID pegawai tidak valid.")
		return
	}

	var input employeeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.RespondBindError(c, err)
		return
	}
	if err := input.normalizeAndValidate(); err != nil {
		utils.RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	updates := map[string]interface{}{
		"name":   input.Name,
		"email":  input.Email,
		"phone":  input.Phone,
		"role":   input.Role,
		"status": input.Status,
		"shift":  input.Shift,
	}
	result := config.DB.Model(&models.Employee{}).
		Where("id = ? AND business_id = ? AND branch_id = ?", employeeID, businessID, branchID).
		Updates(updates)
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memperbarui data pegawai.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Pegawai tidak ditemukan.")
		return
	}

	var employee models.Employee
	if err := config.DB.Where("id = ? AND business_id = ? AND branch_id = ?", employeeID, businessID, branchID).First(&employee).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat data pegawai yang diperbarui.")
		return
	}
	var attendance models.EmployeeAttendance
	attendancePointer := (*models.EmployeeAttendance)(nil)
	if err := config.DB.Where("employee_id = ? AND attendance_date = ?", employeeID, jakartaDate(time.Now())).First(&attendance).Error; err == nil {
		attendancePointer = &attendance
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal memuat kehadiran hari ini.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"employee": employeeToResponse(employee, attendancePointer)})
}

func DeleteEmployee(c *gin.Context) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return
	}
	branchID, ok := employeeBranchID(c)
	if !ok {
		return
	}
	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID pegawai tidak valid.")
		return
	}

	result := config.DB.Where("id = ? AND business_id = ? AND branch_id = ?", employeeID, businessID, branchID).Delete(&models.Employee{})
	if result.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Gagal menghapus data pegawai.")
		return
	}
	if result.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Pegawai tidak ditemukan.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Data pegawai berhasil dihapus."})
}

func ClockInEmployee(c *gin.Context) {
	businessID, branchID, employeeID, ok := employeeAttendanceScope(c)
	if !ok {
		return
	}

	now := time.Now().In(jakartaLocation)
	date := jakartaDate(now)
	var attendance models.EmployeeAttendance
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		var employee models.Employee
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ? AND branch_id = ?", employeeID, businessID, branchID).
			First(&employee).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errEmployeeNotFound
			}
			return err
		}
		if employee.Status != "Aktif" {
			return errEmployeeInactive
		}
		if strings.TrimSpace(employee.Shift) == "" || employee.Shift == "—" {
			return errEmployeeUnscheduled
		}

		err := tx.Where("employee_id = ? AND attendance_date = ?", employeeID, date).First(&attendance).Error
		if err == nil && attendance.ClockIn != nil {
			return errAlreadyClockedIn
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			attendance = models.EmployeeAttendance{
				BusinessID:     businessID,
				BranchID:       branchID,
				EmployeeID:     employeeID,
				AttendanceDate: date,
			}
		}
		attendance.ClockIn = &now
		attendance.Status = employeeAttendanceStatus(employee.Shift, now)
		if attendance.ID == uuid.Nil {
			return tx.Create(&attendance).Error
		}
		return tx.Save(&attendance).Error
	})
	if err != nil {
		respondEmployeeAttendanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"attendance": attendance})
}

func ClockOutEmployee(c *gin.Context) {
	businessID, branchID, employeeID, ok := employeeAttendanceScope(c)
	if !ok {
		return
	}

	now := time.Now().In(jakartaLocation)
	date := jakartaDate(now)
	var attendance models.EmployeeAttendance
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		var employee models.Employee
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND business_id = ? AND branch_id = ?", employeeID, businessID, branchID).
			First(&employee).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errEmployeeNotFound
			}
			return err
		}

		if err := tx.Where("employee_id = ? AND attendance_date = ?", employeeID, date).First(&attendance).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errNotClockedIn
			}
			return err
		}
		if attendance.ClockIn == nil {
			return errNotClockedIn
		}
		if attendance.ClockOut != nil {
			return errAlreadyClockedOut
		}

		attendance.ClockOut = &now
		return tx.Save(&attendance).Error
	})
	if err != nil {
		respondEmployeeAttendanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"attendance": attendance})
}

func employeeAttendanceScope(c *gin.Context) (uuid.UUID, uuid.UUID, uuid.UUID, bool) {
	businessID, ok := getAuthorizedEnterpriseBusiness(c)
	if !ok {
		return uuid.Nil, uuid.Nil, uuid.Nil, false
	}
	branchID, ok := employeeBranchID(c)
	if !ok {
		return uuid.Nil, uuid.Nil, uuid.Nil, false
	}
	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID pegawai tidak valid.")
		return uuid.Nil, uuid.Nil, uuid.Nil, false
	}
	return businessID, branchID, employeeID, true
}

func employeeAttendanceStatus(shift string, clockIn time.Time) string {
	shiftStart, _, ok := strings.Cut(shift, "–")
	if !ok {
		shiftStart, _, ok = strings.Cut(shift, "-")
	}
	if !ok {
		return "Hadir"
	}
	shiftStart = strings.ReplaceAll(strings.TrimSpace(shiftStart), ".", ":")
	start, err := time.ParseInLocation("15:04", shiftStart, jakartaLocation)
	if err != nil {
		return "Hadir"
	}
	clockIn = clockIn.In(jakartaLocation)
	scheduledStart := time.Date(clockIn.Year(), clockIn.Month(), clockIn.Day(), start.Hour(), start.Minute(), 0, 0, jakartaLocation)
	if clockIn.After(scheduledStart) {
		return "Terlambat"
	}
	return "Hadir"
}

func employeeToResponse(employee models.Employee, attendance *models.EmployeeAttendance) employeeResponse {
	response := employeeResponse{Employee: employee, AttendanceStatus: "Belum masuk"}
	if attendance != nil {
		response.AttendanceStatus = attendance.Status
		response.ClockIn = attendance.ClockIn
		response.ClockOut = attendance.ClockOut
	}
	return response
}

func jakartaDate(value time.Time) time.Time {
	local := value.In(jakartaLocation)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, jakartaLocation)
}

func respondEmployeeAttendanceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errEmployeeNotFound):
		utils.RespondError(c, http.StatusNotFound, "Pegawai tidak ditemukan.")
	case errors.Is(err, errEmployeeInactive), errors.Is(err, errEmployeeUnscheduled),
		errors.Is(err, errAlreadyClockedIn), errors.Is(err, errNotClockedIn), errors.Is(err, errAlreadyClockedOut):
		utils.RespondError(c, http.StatusConflict, err.Error()+".")
	default:
		utils.RespondError(c, http.StatusInternalServerError, "Gagal mencatat kehadiran pegawai.")
	}
}

func employeeBranchID(c *gin.Context) (uuid.UUID, bool) {
	branchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "ID cabang tidak valid.")
		return uuid.Nil, false
	}
	return branchID, true
}

func (input *employeeInput) normalizeAndValidate() error {
	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.TrimSpace(input.Email)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Role = strings.TrimSpace(input.Role)
	input.Status = strings.TrimSpace(input.Status)
	input.Shift = strings.TrimSpace(input.Shift)

	if input.Name == "" || input.Email == "" || input.Phone == "" || input.Role == "" {
		return errEmployeeRequiredFields
	}
	if input.Status != "Aktif" && input.Status != "Cuti" {
		return errEmployeeStatusInvalid
	}
	return nil
}
