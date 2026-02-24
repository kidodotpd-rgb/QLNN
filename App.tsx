
import React, { useState, useEffect, useCallback } from 'react';
import { Student, ViolationRecord, User, AppTab, MonthlyRemark, ClassRemark } from './types';
import { MOCK_STUDENTS, MOCK_VIOLATIONS, INITIAL_SCORE } from './constants';
import { mockNow, getSchoolWeekInfo, parseDate } from './src/utils/dateUtils';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import ViolationForm from './components/ViolationForm';
import ChatBot from './components/ChatBot';
import Login from './components/Login';
import ParentView from './components/ParentView';
import StudentDetailView from './components/StudentDetailView';
import RankingBoard from './components/RankingBoard';
import ClassMonitorPortal from './components/ClassMonitorPortal';
import Logo from './components/Logo';
import { Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [violations, setViolations] = useState<ViolationRecord[]>(MOCK_VIOLATIONS);
  const [monthlyRemarks, setMonthlyRemarks] = useState<MonthlyRemark[]>([]);
  const [classRemarks, setClassRemarks] = useState<ClassRemark[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isGoodStudyWeek, setIsGoodStudyWeek] = useState(false);

  // Load user from local storage if available (mock persistence)
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
    if (loggedInUser.role === 'PARENT') {
      setActiveTab('my-child');
    } else if (loggedInUser.role === 'MONITOR') {
      setActiveTab('monitor-tool');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    setSelectedStudent(null);
    setActiveTab('dashboard');
  };

  // --- Data Handlers ---

  const handleAddViolation = (record: ViolationRecord) => {
    setViolations(prev => [...prev, record]);
    
    // Update student score
    setStudents(prev => prev.map(s => {
      if (s.id === record.studentId) {
        return { ...s, score: s.score + record.points };
      }
      return s;
    }));
  };

  const handleUpdateViolation = (updatedRecord: ViolationRecord) => {
    let pointDifference = 0;
    
    setViolations(prev => prev.map(v => {
        if (v.id === updatedRecord.id) {
            // Calculate difference: New Points - Old Points
            // Example: Old 10, New 15 -> Diff +5. Score += 5.
            // Example: Old -10, New -5 -> Diff +5. Score += 5.
            pointDifference = updatedRecord.points - v.points;
            return updatedRecord;
        }
        return v;
    }));

    if (pointDifference !== 0) {
        setStudents(prev => prev.map(s => {
            if (s.id === updatedRecord.studentId) {
                return { ...s, score: s.score + pointDifference };
            }
            return s;
        }));
        
        // Update selected student view immediately if applicable
        if (selectedStudent && selectedStudent.id === updatedRecord.studentId) {
            setSelectedStudent(prev => prev ? { ...prev, score: prev.score + pointDifference } : null);
        }
    }
  };

  const handleDeleteViolation = (id: string) => {
    const recordToDelete = violations.find(v => v.id === id);
    if (!recordToDelete) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xoá bản ghi vi phạm của em ${recordToDelete.studentName}?`)) {
      return;
    }

    setViolations(prev => prev.filter(v => v.id !== id));
    
    // Revert score
    setStudents(prev => prev.map(s => {
      if (s.id === recordToDelete.studentId) {
        return { ...s, score: s.score - recordToDelete.points };
      }
      return s;
    }));
  };

  const handleDeleteViolations = (ids: string[]) => {
    const recordsToDelete = violations.filter(v => ids.includes(v.id));
    if (recordsToDelete.length === 0) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xoá ${ids.length} bản ghi đã chọn?`)) {
      return;
    }

    setViolations(prev => prev.filter(v => !ids.includes(v.id)));

    // Recalc scores for affected students
    const affectedStudentIds = new Set(recordsToDelete.map(v => v.studentId));
    
    setStudents(prev => prev.map(s => {
      if (affectedStudentIds.has(s.id)) {
        const studentDeletedRecords = recordsToDelete.filter(r => r.studentId === s.id);
        const pointsReverted = studentDeletedRecords.reduce((acc, r) => acc + r.points, 0);
        return { ...s, score: s.score - pointsReverted };
      }
      return s;
    }));
  };

  const handleDeleteClassesData = (classNames: string[]) => {
    if (classNames.length === 0) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xoá TOÀN BỘ dữ liệu vi phạm của ${classNames.length} lớp đã chọn? Hành động này không thể hoàn tác.`)) {
      return;
    }

    const recordsToDelete = violations.filter(v => classNames.includes(v.className));
    
    setViolations(prev => prev.filter(v => !classNames.includes(v.className)));

    // Recalc scores for all students in these classes
    const affectedStudentIds = new Set(recordsToDelete.map(v => v.studentId));
    
    setStudents(prev => prev.map(s => {
      if (affectedStudentIds.has(s.id)) {
        const studentDeletedRecords = recordsToDelete.filter(r => r.studentId === s.id);
        const pointsReverted = studentDeletedRecords.reduce((acc, r) => acc + r.points, 0);
        return { ...s, score: s.score - pointsReverted };
      }
      return s;
    }));
  };

  const handleDeleteClassWeekData = (className: string, week: number) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá dữ liệu của lớp ${className} trong Tuần ${week}?`)) {
      return;
    }

    const recordsToDelete = violations.filter(v => 
      v.className === className && getSchoolWeekInfo(parseDate(v.date)).week === week
    );
    
    if (recordsToDelete.length === 0) {
      alert('Không có dữ liệu để xoá cho tuần này.');
      return;
    }

    const idsToDelete = recordsToDelete.map(v => v.id);
    setViolations(prev => prev.filter(v => !idsToDelete.includes(v.id)));

    // Recalc scores
    const affectedStudentIds = new Set(recordsToDelete.map(v => v.studentId));
    setStudents(prev => prev.map(s => {
      if (affectedStudentIds.has(s.id)) {
        const studentDeletedRecords = recordsToDelete.filter(r => r.studentId === s.id);
        const pointsReverted = studentDeletedRecords.reduce((acc, r) => acc + r.points, 0);
        return { ...s, score: s.score - pointsReverted };
      }
      return s;
    }));
  };

  const handleAddStudent = (newStudent: Student) => {
    setStudents(prev => [...prev, newStudent]);
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    if (selectedStudent && selectedStudent.id === updatedStudent.id) {
        setSelectedStudent(updatedStudent);
    }
  };

  const handleArchiveStudent = (studentId: string, archive: boolean, reason?: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return { 
          ...s, 
          isArchived: archive, 
          archivedAt: archive ? mockNow.toLocaleDateString('vi-VN') : undefined,
          archivedReason: archive ? reason : undefined
        };
      }
      return s;
    }));
  };

  const handleUpdateRemark = (remark: MonthlyRemark) => {
    setMonthlyRemarks(prev => {
      const existing = prev.findIndex(r => r.studentId === remark.studentId && r.monthYear === remark.monthYear);
      if (existing >= 0) {
        const newRemarks = [...prev];
        newRemarks[existing] = remark;
        return newRemarks;
      }
      return [...prev, remark];
    });
  };

  const handleUpdateClassRemark = (remark: ClassRemark) => {
    setClassRemarks(prev => {
      const existing = prev.findIndex(r => r.className === remark.className && r.period === remark.period);
      if (existing > -1) {
        const updated = [...prev];
        updated[existing] = remark;
        return updated;
      }
      return [...prev, remark];
    });
  };

  // --- View Logic ---

  if (!user) {
    return <Login onLogin={handleLogin} students={students} />;
  }

  // Filter accessible data based on role
  const accessibleStudents = (user.role === 'TEACHER' || user.role === 'MONITOR') && user.assignedClass
    ? students.filter(s => s.class === user.assignedClass)
    : students;

  const accessibleViolations = (user.role === 'TEACHER' || user.role === 'MONITOR') && user.assignedClass
    ? violations.filter(v => v.className === user.assignedClass)
    : violations;

  // For Parent View logic
  if (user.role === 'PARENT') {
    const myStudent = students.find(s => s.id === user.studentId);
    if (!myStudent) return <div className="p-10 text-center">Không tìm thấy dữ liệu học sinh. Vui lòng liên hệ nhà trường. <button onClick={handleLogout} className="text-blue-600 underline ml-2">Đăng xuất</button></div>;
    
    return (
      <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} user={user} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 ml-0 lg:ml-64">
           <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5 }}
             className="h-full"
           >
             {activeTab === 'my-child' && <ParentView student={myStudent} violations={violations} />}
             {activeTab === 'ranking' && (
                <RankingBoard 
                  students={students} 
                  violations={violations} 
                  userRole={user.role}
                  isGoodStudyWeek={isGoodStudyWeek}
                  onToggleGoodStudyWeek={setIsGoodStudyWeek}
                />
             )}
             {activeTab === 'monitor-tool' && (
                <ClassMonitorPortal 
                  students={students} 
                  violations={violations}
                  onAddRecord={handleAddViolation}
                  mode="inline"
                  currentUser={user}
                />
             )}
           </motion.div>
        </main>
         <ChatBot students={[myStudent]} violations={violations.filter(v => v.studentId === myStudent.id)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setSelectedStudent(null); }} onLogout={handleLogout} user={user} />

      <main className="flex-1 overflow-y-auto p-4 lg:p-8 ml-0 lg:ml-64 relative">
        <header className="flex justify-between items-center mb-8 bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 border border-slate-100 p-1.5 overflow-hidden">
              <Logo size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                {selectedStudent ? 'Chi tiết Học sinh' : 
                 activeTab === 'dashboard' ? 'THPT Số 3 Tuy Phước' : 
                 activeTab === 'students' ? 'Danh sách Học sinh' : 
                 activeTab === 'monitor-tool' ? 'Cổng nhập liệu SĐB' :
                 activeTab === 'record' ? 'Ghi nhận Vi phạm' : 'Bảng xếp hạng Thi đua'}
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Hệ thống Quản lý Nề nếp</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black text-emerald-700 uppercase">Live System</span>
             </div>
             <button className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shadow-sm relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
             </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedStudent ? `detail-${selectedStudent.id}` : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full"
          >
            {selectedStudent ? (
               <StudentDetailView 
                  student={selectedStudent} 
                  violations={violations}
                  monthlyRemarks={monthlyRemarks}
                  onBack={() => setSelectedStudent(null)}
                  userRole={user.role}
                  onAddRecord={handleAddViolation}
                  onUpdateRecord={handleUpdateViolation}
                  onDeleteRecord={handleDeleteViolation}
                  onUpdateRemark={handleUpdateRemark}
                  onUpdateStudent={handleUpdateStudent}
               />
            ) : (
              <div className="h-full flex flex-col pb-10">
                {activeTab === 'dashboard' && (
                    <Dashboard 
                        students={accessibleStudents} 
                        violations={accessibleViolations} 
                        onAddRecord={handleAddViolation}
                        userRole={user.role}
                        currentUser={user}
                        onNavigate={setActiveTab}
                        isGoodStudyWeek={isGoodStudyWeek}
                        onToggleGoodStudyWeek={setIsGoodStudyWeek}
                    />
                )}
                
                {activeTab === 'students' && (
                  <StudentList 
                    students={accessibleStudents} 
                    violations={accessibleViolations} 
                    userRole={user.role}
                    onViewDetail={setSelectedStudent}
                    onUpdateStudent={handleUpdateStudent}
                    onAddStudent={handleAddStudent}
                    onAddViolation={(student) => {
                        setSelectedStudent(null); // Ensure we are not in detail view
                        setActiveTab('record');
                    }}
                    onArchiveStudent={handleArchiveStudent}
                  />
                )}
                
                {activeTab === 'record' && (
                  <ViolationForm 
                    students={accessibleStudents} 
                    onAddRecord={handleAddViolation}
                    userRole={user.role}
                    initialStudentId="" 
                  />
                )}

                {activeTab === 'monitor-tool' && (
                   <div className="h-full">
                      <ClassMonitorPortal 
                        students={accessibleStudents} 
                        violations={accessibleViolations}
                        onAddRecord={handleAddViolation}
                        mode="inline"
                        currentUser={user}
                      />
                   </div>
                )}

                {activeTab === 'ranking' && (
                  <RankingBoard 
                    students={accessibleStudents} 
                    violations={accessibleViolations} 
                    userRole={user.role}
                    onDeleteViolations={handleDeleteViolations}
                    onDeleteClassesData={handleDeleteClassesData}
                    onDeleteClassWeekData={handleDeleteClassWeekData}
                    isGoodStudyWeek={isGoodStudyWeek}
                    onToggleGoodStudyWeek={setIsGoodStudyWeek}
                    classRemarks={classRemarks}
                    onUpdateClassRemark={handleUpdateClassRemark}
                  />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ChatBot students={accessibleStudents} violations={accessibleViolations} />
    </div>
  );
};

export default App;
