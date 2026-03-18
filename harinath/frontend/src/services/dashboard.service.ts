import api from './api';

// ============================================================
// Dashboard Service - API integration + placeholder mock data
// ============================================================

// ---------- Types ----------

export interface ProfileData {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  location: string;
  manager: string;
  joiningDate: string;
  profilePictureUrl?: string;
  status: string;
}

export interface AttendanceStats {
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  todayStatus: 'Present' | 'Absent' | 'Late' | 'Not Marked';
  weeklyData: { day: string; hours: number; status: string }[];
}

export interface LeaveBalance {
  type: string;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  reason: string;
}

export interface SalaryInfo {
  currentSalary: number;
  bonus: number;
  incentives: number;
  lastPaidDate: string;
  ytdEarnings: number;
  recentPayslips: { id: string; month: string; amount: number; date: string }[];
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  priority: 'high' | 'medium' | 'low';
  progress: number;
  deadline: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'hr' | 'policy' | 'event' | 'system';
  time: string;
  read: boolean;
}

export interface PerformanceData {
  overallRating: number;
  kpiScore: number;
  nextReviewDate: string;
  trendData: { month: string; score: number }[];
  kpis: { name: string; score: number; target: number }[];
}

export interface HolidayItem {
  id: string;
  name: string;
  date: string;
  day: string;
  type: 'Festival' | 'Public Holiday' | 'Optional';
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  status: 'verified' | 'available' | 'pending';
  description: string;
  format: string;
  size: string;
  date: string;
}

export interface BirthdayPerson {
  id: string;
  name: string;
  department: string;
  date: string;
  profilePictureUrl?: string;
}

export interface AnniversaryPerson {
  id: string;
  name: string;
  department: string;
  years: number;
  date: string;
  profilePictureUrl?: string;
}

// ---------- API Fetchers (real endpoints) ----------

export async function fetchProfile(employeeId: string): Promise<ProfileData> {
  try {
    const response = await api.get(`/employees/${employeeId}`);
    const emp = response.data?.data?.employee || response.data?.data || response.data;
    return {
      id: emp.id,
      employeeCode: emp.employeeCode || 'N/A',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || emp.user?.email || '',
      phone: emp.phone || emp.mobile || '',
      department: emp.department?.name || 'N/A',
      position: emp.position?.title || emp.position?.name || 'N/A',
      location: emp.location?.name || emp.workLocation || 'N/A',
      manager: emp.reportingManager
        ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}`
        : 'N/A',
      joiningDate: emp.dateOfJoining || emp.joiningDate || '',
      profilePictureUrl: emp.profilePictureUrl,
      status: emp.status || 'ACTIVE',
    };
  } catch {
    return getMockProfile();
  }
}

export async function fetchAttendanceStats(
  organizationId: string,
  employeeId?: string
): Promise<AttendanceStats> {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const params: Record<string, string> = {
      startDate: startOfMonth,
      endDate,
      organizationId,
      page: '1',
      limit: '1000',
    };
    if (employeeId) params.employeeId = employeeId;

    const response = await api.get('/attendance/records', { params });
    const records = response.data?.data?.data || response.data?.data || [];

    const presentCount = records.filter(
      (r: any) => r.status === 'PRESENT'
    ).length;
    const lateCount = records.filter((r: any) => r.status === 'LATE').length;
    const absentCount = records.filter((r: any) => r.status === 'ABSENT').length;
    const workingDays = presentCount + lateCount + absentCount;

    // Today's status
    const todayRecord = records.find(
      (r: any) => r.date?.split('T')[0] === endDate
    );
    const todayStatus = todayRecord?.status || 'Not Marked';

    // Build weekly data from last 7 days
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = weekDays.map((day, i) => {
      const d = new Date(today);
      const currentDay = d.getDay();
      const diff = currentDay === 0 ? 6 : currentDay - 1;
      d.setDate(d.getDate() - diff + i);
      const dateStr = d.toISOString().split('T')[0];
      const rec = records.find((r: any) => r.date?.split('T')[0] === dateStr);
      return {
        day,
        hours: rec?.totalHours || rec?.workedHours || 0,
        status: rec?.status || 'absent',
      };
    });

    return { workingDays, present: presentCount, absent: absentCount, late: lateCount, todayStatus, weeklyData };
  } catch {
    return getMockAttendance();
  }
}

export async function fetchLeaveData(
  organizationId: string,
  employeeId?: string
): Promise<{ balances: LeaveBalance[]; requests: LeaveRequest[] }> {
  try {
    const params: Record<string, string> = { organizationId };
    if (employeeId) params.employeeId = employeeId;

    const [balanceRes, requestsRes] = await Promise.allSettled([
      api.get('/leaves/balance', { params }),
      api.get('/leaves/requests', { params: { ...params, page: '1', limit: '5' } }),
    ]);

    let balances: LeaveBalance[] = [];
    if (balanceRes.status === 'fulfilled') {
      const data = balanceRes.value.data?.data || balanceRes.value.data || [];
      balances = Array.isArray(data)
        ? data.map((b: any) => ({
            type: b.leaveType?.name || b.type || 'Leave',
            total: b.totalAllotted || b.total || 0,
            used: b.used || 0,
            remaining: b.remaining || b.balance || 0,
          }))
        : [];
    }

    let requests: LeaveRequest[] = [];
    if (requestsRes.status === 'fulfilled') {
      const data =
        requestsRes.value.data?.data?.data ||
        requestsRes.value.data?.data ||
        [];
      requests = Array.isArray(data)
        ? data.slice(0, 3).map((r: any) => ({
            id: r.id,
            type: r.leaveType?.name || r.type || 'Leave',
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status,
            reason: r.reason || '',
          }))
        : [];
    }

    if (balances.length === 0) balances = getMockLeaveBalances();
    return { balances, requests };
  } catch {
    return { balances: getMockLeaveBalances(), requests: getMockLeaveRequests() };
  }
}

export async function fetchSalaryInfo(employeeId: string): Promise<SalaryInfo> {
  try {
    const response = await api.get(`/payroll/employee-salaries`, {
      params: { employeeId, page: '1', limit: '1' },
    });
    const salaries = response.data?.data?.data || response.data?.data || [];
    const current = Array.isArray(salaries) ? salaries[0] : salaries;

    // Try to fetch payslips
    let recentPayslips: SalaryInfo['recentPayslips'] = [];
    try {
      const payslipRes = await api.get(`/payroll/payslips`, {
        params: { employeeId, page: '1', limit: '3' },
      });
      const slips = payslipRes.data?.data?.data || payslipRes.data?.data || [];
      recentPayslips = Array.isArray(slips)
        ? slips.map((s: any) => ({
            id: s.id,
            month: s.month || s.period || '',
            amount: s.netPay || s.netSalary || 0,
            date: s.paidDate || s.createdAt || '',
          }))
        : [];
    } catch {
      recentPayslips = getMockPayslips();
    }

    return {
      currentSalary: current?.grossSalary || current?.ctc || 0,
      bonus: current?.bonus || 0,
      incentives: current?.incentives || 0,
      lastPaidDate: current?.lastPaidDate || 'N/A',
      ytdEarnings: current?.ytdEarnings || 0,
      recentPayslips: recentPayslips.length > 0 ? recentPayslips : getMockPayslips(),
    };
  } catch {
    return getMockSalaryInfo();
  }
}

export async function fetchHolidays(organizationId: string): Promise<HolidayItem[]> {
  try {
    const response = await api.get('/holidays', {
      params: { organizationId },
    });
    const data = response.data?.data?.data || response.data?.data || response.data || [];
    const holidays = Array.isArray(data) ? data : [];

    return holidays.map((h: any) => {
      const date = new Date(h.date || h.startDate);
      return {
        id: h.id,
        name: h.name || h.title,
        date: h.date || h.startDate,
        day: date.toLocaleDateString('en-US', { weekday: 'long' }),
        type: h.type || 'Public Holiday',
      };
    });
  } catch {
    return getMockHolidays();
  }
}

// ---------- Mock data for features without backend ----------

function getMockProfile(): ProfileData {
  return {
    id: 'mock-1',
    employeeCode: 'EMP001',
    firstName: 'Employee',
    lastName: 'User',
    email: 'employee@company.com',
    phone: '+91 9876543210',
    department: 'Engineering',
    position: 'Software Developer',
    location: 'Bangalore',
    manager: 'Team Lead',
    joiningDate: '2023-06-15',
    status: 'ACTIVE',
  };
}

function getMockAttendance(): AttendanceStats {
  return {
    workingDays: 22,
    present: 20,
    absent: 1,
    late: 1,
    todayStatus: 'Present',
    weeklyData: [
      { day: 'Mon', hours: 8.5, status: 'present' },
      { day: 'Tue', hours: 9, status: 'present' },
      { day: 'Wed', hours: 7.5, status: 'late' },
      { day: 'Thu', hours: 8, status: 'present' },
      { day: 'Fri', hours: 8.5, status: 'present' },
      { day: 'Sat', hours: 0, status: 'absent' },
      { day: 'Sun', hours: 0, status: 'absent' },
    ],
  };
}

function getMockLeaveBalances(): LeaveBalance[] {
  return [
    { type: 'Sick Leave', total: 12, used: 3, remaining: 9 },
    { type: 'Casual Leave', total: 10, used: 4, remaining: 6 },
    { type: 'Earned Leave', total: 15, used: 2, remaining: 13 },
  ];
}

function getMockLeaveRequests(): LeaveRequest[] {
  return [
    { id: '1', type: 'Sick Leave', startDate: '2026-03-05', endDate: '2026-03-06', status: 'APPROVED', reason: 'Medical appointment' },
    { id: '2', type: 'Casual Leave', startDate: '2026-02-20', endDate: '2026-02-20', status: 'APPROVED', reason: 'Personal work' },
    { id: '3', type: 'Earned Leave', startDate: '2026-04-10', endDate: '2026-04-12', status: 'PENDING', reason: 'Family function' },
  ];
}

function getMockPayslips(): SalaryInfo['recentPayslips'] {
  return [
    { id: '1', month: 'February 2026', amount: 85000, date: '2026-02-28' },
    { id: '2', month: 'January 2026', amount: 85000, date: '2026-01-31' },
    { id: '3', month: 'December 2025', amount: 92000, date: '2025-12-31' },
  ];
}

function getMockSalaryInfo(): SalaryInfo {
  return {
    currentSalary: 85000,
    bonus: 5000,
    incentives: 2500,
    lastPaidDate: '28 Feb 2026',
    ytdEarnings: 170000,
    recentPayslips: getMockPayslips(),
  };
}

function getMockHolidays(): HolidayItem[] {
  return [
    { id: '1', name: 'Holi', date: '2026-03-17', day: 'Tuesday', type: 'Festival' },
    { id: '2', name: 'Good Friday', date: '2026-04-03', day: 'Friday', type: 'Public Holiday' },
    { id: '3', name: 'Labour Day', date: '2026-05-01', day: 'Friday', type: 'Public Holiday' },
    { id: '4', name: 'Independence Day', date: '2026-08-15', day: 'Saturday', type: 'Public Holiday' },
    { id: '5', name: 'Gandhi Jayanti', date: '2026-10-02', day: 'Friday', type: 'Public Holiday' },
    { id: '6', name: 'Diwali', date: '2026-11-08', day: 'Sunday', type: 'Festival' },
    { id: '7', name: 'Christmas', date: '2026-12-25', day: 'Friday', type: 'Public Holiday' },
  ];
}

export function getMockTasks(): TaskItem[] {
  return [
    { id: '1', title: 'Complete quarterly report', status: 'in-progress', priority: 'high', progress: 65, deadline: '2026-03-15' },
    { id: '2', title: 'Update project documentation', status: 'pending', priority: 'medium', progress: 0, deadline: '2026-03-20' },
    { id: '3', title: 'Review team performance', status: 'completed', priority: 'high', progress: 100, deadline: '2026-03-10' },
    { id: '4', title: 'Prepare presentation slides', status: 'in-progress', priority: 'medium', progress: 40, deadline: '2026-03-18' },
    { id: '5', title: 'Submit expense claims', status: 'pending', priority: 'low', progress: 0, deadline: '2026-03-25' },
  ];
}

export function getMockNotifications(): NotificationItem[] {
  return [
    { id: '1', title: 'Company Town Hall', message: 'Annual town hall meeting scheduled for March 15th at 3 PM.', type: 'announcement', time: '2 hours ago', read: false },
    { id: '2', title: 'Payslip Generated', message: 'Your February 2026 payslip is now available for download.', type: 'hr', time: '1 day ago', read: false },
    { id: '3', title: 'Policy Update', message: 'Work from home policy updated. Please review the changes.', type: 'policy', time: '2 days ago', read: true },
    { id: '4', title: 'Team Outing', message: 'Team building event on March 22nd. RSVP by March 18th.', type: 'event', time: '3 days ago', read: true },
    { id: '5', title: 'System Maintenance', message: 'Scheduled maintenance on March 12th from 11 PM to 2 AM.', type: 'system', time: '4 days ago', read: false },
  ];
}

export function getMockPerformance(): PerformanceData {
  return {
    overallRating: 4.5,
    kpiScore: 88,
    nextReviewDate: '2026-06-15',
    trendData: [
      { month: 'Oct', score: 82 },
      { month: 'Nov', score: 85 },
      { month: 'Dec', score: 84 },
      { month: 'Jan', score: 87 },
      { month: 'Feb', score: 88 },
      { month: 'Mar', score: 90 },
    ],
    kpis: [
      { name: 'Code Quality', score: 92, target: 90 },
      { name: 'Delivery Speed', score: 85, target: 88 },
      { name: 'Team Collaboration', score: 90, target: 85 },
      { name: 'Innovation', score: 82, target: 80 },
      { name: 'Documentation', score: 88, target: 85 },
    ],
  };
}

export function getMockDocuments(): DocumentItem[] {
  return [
    { id: '1', name: 'Offer Letter', type: 'letter', status: 'verified', description: 'Employment offer letter', format: 'PDF', size: '245 KB', date: '2023-06-01' },
    { id: '2', name: 'Appointment Letter', type: 'letter', status: 'verified', description: 'Official appointment letter', format: 'PDF', size: '312 KB', date: '2023-06-15' },
    { id: '3', name: 'Feb 2026 Payslip', type: 'payslip', status: 'available', description: 'Monthly salary payslip', format: 'PDF', size: '180 KB', date: '2026-02-28' },
    { id: '4', name: 'Employee ID Card', type: 'id', status: 'verified', description: 'Company identity card', format: 'PDF', size: '95 KB', date: '2023-07-01' },
    { id: '5', name: 'Tax Declaration Form', type: 'tax', status: 'pending', description: 'Annual tax declaration', format: 'PDF', size: '420 KB', date: '2026-01-15' },
  ];
}

export function getMockBirthdays(): BirthdayPerson[] {
  return [
    { id: '1', name: 'Priya Sharma', department: 'Marketing', date: 'Today' },
    { id: '2', name: 'Rahul Verma', department: 'Engineering', date: 'Tomorrow' },
    { id: '3', name: 'Anita Desai', department: 'HR', date: 'Mar 12' },
  ];
}

export function getMockAnniversaries(): AnniversaryPerson[] {
  return [
    { id: '1', name: 'Vikram Singh', department: 'Finance', years: 5, date: 'Today' },
    { id: '2', name: 'Meera Patel', department: 'Engineering', years: 3, date: 'Mar 11' },
    { id: '3', name: 'Arjun Nair', department: 'Sales', years: 2, date: 'Mar 14' },
  ];
}

// Daily motivation quotes - rotates based on day of year
const MOTIVATION_QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { quote: "Great things never come from comfort zones.", author: "Unknown" },
  { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
  { quote: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { quote: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { quote: "Little things make big days.", author: "Unknown" },
  { quote: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
  { quote: "Don't wait for opportunity. Create it.", author: "Unknown" },
  { quote: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", author: "Unknown" },
  { quote: "The key to success is to focus on goals, not obstacles.", author: "Unknown" },
  { quote: "Dream bigger. Do bigger.", author: "Unknown" },
  { quote: "Work hard in silence, let your success be the noise.", author: "Frank Ocean" },
  { quote: "Stay positive, work hard, make it happen.", author: "Unknown" },
  { quote: "Don't limit your challenges. Challenge your limits.", author: "Unknown" },
  { quote: "Every champion was once a contender that never gave up.", author: "Rocky Balboa" },
  { quote: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
  { quote: "If you want to achieve greatness stop asking for permission.", author: "Unknown" },
  { quote: "Things work out best for those who make the best of how things work out.", author: "John Wooden" },
];

export function getDailyQuote(): { quote: string; author: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length];
}
