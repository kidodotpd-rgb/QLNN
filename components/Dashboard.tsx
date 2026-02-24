
import React, { useState, useMemo } from 'react';
import { Student, ViolationRecord, Role, AppTab, User } from '../types';
import { mockNow, getSchoolWeekInfo, parseDate } from '../src/utils/dateUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import ClassMonitorPortal from './ClassMonitorPortal';
import { motion } from 'motion/react';
import { 
  Users, 
  AlertTriangle, 
  BookOpen, 
  LineChart, 
  PlusCircle, 
  FileOutput, 
  TrendingUp, 
  Database, 
  Clock,
  ChevronRight,
  Calendar,
  Filter,
  Sparkles,
  ShieldAlert,
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  students: Student[];
  violations: ViolationRecord[];
  onAddRecord?: (record: ViolationRecord) => void;
  userRole?: Role;
  currentUser?: User;
  onNavigate?: (tab: AppTab) => void;
  isGoodStudyWeek?: boolean;
  onToggleGoodStudyWeek?: (value: boolean) => void;
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const SOURCE_COLORS = {
  ADMIN: '#e11d48',
  TEACHER: '#2563eb',
  TASKFORCE: '#f59e0b',
  PARENT: '#10b981',
  MONITOR: '#9333ea'
};

const Dashboard: React.FC<DashboardProps> = ({ 
  students, 
  violations, 
  onAddRecord, 
  userRole, 
  currentUser, 
  onNavigate,
  isGoodStudyWeek,
  onToggleGoodStudyWeek
}) => {
  const [filterMode, setFilterMode] = useState<'month' | 'week'>('month');
  const [selectedRange, setSelectedRange] = useState<string>('All');
  const [showMonitorPortal, setShowMonitorPortal] = useState(false);

  // --- LOGIC TÍNH TOÁN THỜI GIAN THỰC TẾ ---
  // const NOW = new Date(); 

  const getDateInfo = (dateStr: string) => {
    const date = parseDate(dateStr);
    const info = getSchoolWeekInfo(date);
    
    const weekNum = info.week;
    let weekLabel = "";
    let sortValue = 0;
    const isHoliday = info.isHoliday || false;

    if (weekNum === 0) {
        weekLabel = "Trước khai giảng";
    } else if (weekNum === -1) {
        weekLabel = "Nghỉ Tết Âm Lịch";
    } else if (weekNum > 0 && info.weekEndDate) {
        const startOfWeek = new Date(info.weekEndDate);
        startOfWeek.setDate(startOfWeek.getDate() - 6);
        const endOfWeek = info.weekEndDate;
        const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        weekLabel = `Tuần ${weekNum} (${fmt(startOfWeek)} - ${fmt(endOfWeek)})`;
    } else if (weekNum > 0) {
        weekLabel = `Tuần ${weekNum}`;
    }

    sortValue = date.getFullYear() * 1000 + (weekNum === -1 ? 999 : weekNum);
    
    return { 
      week: weekNum, 
      year: date.getFullYear(), 
      reportMonth: info.reportMonthLabel, 
      weekLabel, 
      sortValue, 
      isHoliday 
    };
  };

  const availableRanges = useMemo(() => {
    if (filterMode === 'month') {
      const ranges = new Set<string>();
      violations.forEach(v => ranges.add(getDateInfo(v.date).reportMonth));
      ranges.add(getSchoolWeekInfo(mockNow).reportMonthLabel);
      return Array.from(ranges).sort((a, b) => {
        const [m1, y1] = a.split('/').map(Number);
        const [m2, y2] = b.split('/').map(Number);
        return y2 - y1 || m2 - m1;
      });
    } else {
      const ranges = new Map<string, number>();
      violations.forEach(v => {
        const info = getDateInfo(v.date);
        if (info.week > 0 && !info.isHoliday) ranges.set(info.weekLabel, info.sortValue);
      });
      const currentInfo = getDateInfo(mockNow.toLocaleDateString('vi-VN'));
      if(currentInfo.week > 0 && !currentInfo.isHoliday) ranges.set(currentInfo.weekLabel, currentInfo.sortValue);
      return Array.from(ranges.keys()).sort((a, b) => (ranges.get(b) || 0) - (ranges.get(a) || 0));
    }
  }, [violations, filterMode]);

  const setQuickFilter = (mode: 'week' | 'month') => {
    setFilterMode(mode);
    const info = getDateInfo(mockNow.toLocaleDateString('vi-VN'));
    if (mode === 'week') setSelectedRange(info.week > 0 ? info.weekLabel : 'All');
    else setSelectedRange(info.reportMonth);
  };

  const filteredViolations = useMemo(() => {
    if (selectedRange === 'All') return violations;
    return violations.filter(v => {
      const info = getDateInfo(v.date);
      return filterMode === 'month' ? info.reportMonth === selectedRange : info.weekLabel === selectedRange;
    });
  }, [violations, selectedRange, filterMode]);

  const totalViolations = filteredViolations.length;
  const goodDeeds = filteredViolations.filter(v => v.points > 0).length;
  const averageScore = students.reduce((acc, s) => acc + s.score, 0) / (students.length || 1);
  
  const trendData = useMemo(() => {
    const stats: Record<string, { violations: number, rewards: number }> = {};
    filteredViolations.forEach(v => {
      const [day, month] = v.date.split('/');
      const key = `${day}/${month}`;
      if (!stats[key]) stats[key] = { violations: 0, rewards: 0 };
      if (v.points < 0) stats[key].violations++;
      else stats[key].rewards++;
    });
    return Object.keys(stats).map(date => {
        const parts = date.split('/').map(Number);
        return { 
          name: date, 
          violations: stats[date].violations, 
          rewards: stats[date].rewards,
          sortValue: parts[1] * 100 + parts[0] 
        };
    }).sort((a, b) => a.sortValue - b.sortValue);
  }, [filteredViolations]);

  const barChartData = useMemo(() => {
    const classStats = filteredViolations.reduce((acc: any, v) => {
      acc[v.className] = (acc[v.className] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(classStats).map(className => ({ name: className, violations: classStats[className] }))
      .sort((a, b) => b.violations - a.violations).slice(0, 10);
  }, [filteredViolations]);

  const sourceChartData = useMemo(() => {
    const sourceStats = filteredViolations.reduce((acc: any, v) => {
      const role = v.recordedRole || 'TEACHER';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(sourceStats).map(role => ({
      name: role === 'ADMIN' ? 'Ban Quản trị' : role === 'TASKFORCE' ? 'Đội TNXK' : role === 'MONITOR' ? 'Cán sự lớp' : 'Giáo viên',
      value: sourceStats[role],
      color: (SOURCE_COLORS as any)[role] || '#94a3b8'
    }));
  }, [filteredViolations]);

  const violationTypeData = useMemo(() => {
    const typeStats = filteredViolations.reduce((acc: any, v) => {
      if (v.points < 0) {
        acc[v.type] = (acc[v.type] || 0) + 1;
      }
      return acc;
    }, {});
    return Object.keys(typeStats)
      .map(type => ({ name: type, value: typeStats[type] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredViolations]);

  const scoreDistributionData = useMemo(() => {
    const distribution = [
      { name: '< 150', value: 0, color: '#f43f5e' },
      { name: '150-179', value: 0, color: '#f59e0b' },
      { name: '180-199', value: 0, color: '#3b82f6' },
      { name: '≥ 200', value: 0, color: '#10b981' },
    ];
    students.forEach(s => {
      if (s.score < 150) distribution[0].value++;
      else if (s.score < 180) distribution[1].value++;
      else if (s.score < 200) distribution[2].value++;
      else distribution[3].value++;
    });
    return distribution;
  }, [students]);

  const classRadarData = useMemo(() => {
    // Compare top 5 classes across different metrics
    const classMetrics: Record<string, { name: string, score: number, violations: number, rewards: number }> = {};
    
    // Get top 5 classes by average score
    const classAvgScores: Record<string, { total: number, count: number }> = {};
    students.forEach(s => {
      if (!classAvgScores[s.class]) classAvgScores[s.class] = { total: 0, count: 0 };
      classAvgScores[s.class].total += s.score;
      classAvgScores[s.class].count++;
    });

    const topClasses = Object.keys(classAvgScores)
      .map(cls => ({ name: cls, avg: classAvgScores[cls].total / classAvgScores[cls].count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map(c => c.name);

    topClasses.forEach(cls => {
      classMetrics[cls] = { 
        name: cls, 
        score: Math.round(classAvgScores[cls].total / classAvgScores[cls].count),
        violations: 0,
        rewards: 0
      };
    });

    filteredViolations.forEach(v => {
      if (classMetrics[v.className]) {
        if (v.points < 0) classMetrics[v.className].violations++;
        else classMetrics[v.className].rewards++;
      }
    });

    return topClasses.map(cls => ({
      subject: cls,
      A: classMetrics[cls].score / 2.5, // Normalized for radar
      B: classMetrics[cls].rewards * 10,
      C: 100 - (classMetrics[cls].violations * 5),
      fullMark: 100
    }));
  }, [students, filteredViolations]);

  const handleExportCSV = () => {
    const headers = ['Mã HS', 'Tên Học sinh', 'Lớp', 'Ngày vi phạm', 'Loại vi phạm', 'Nội dung chi tiết', 'Điểm', 'Người ghi nhận', 'Vai trò', 'Tuần', 'Tháng báo cáo'];
    const csvContent = [headers.join(','), ...filteredViolations.map(v => {
        const info = getDateInfo(v.date);
        return [v.studentId, `"${v.studentName}"`, v.className, v.date, `"${v.type}"`, `"${v.note?.replace(/"/g, '""')}"`, v.points, v.recordedBy, v.recordedRole, info.week > 0 ? `Tuần ${info.week}` : info.weekLabel, info.reportMonth].join(',');
    })].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao_cao_ne_nep_${selectedRange === 'All' ? 'tong_hop' : selectedRange.replace(/[()\/:\s-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-8 pb-10">
      {/* Action Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
         <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto glass-card p-2 rounded-2xl">
            <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 w-full sm:w-auto">
              <button 
                onClick={() => setQuickFilter('week')}
                className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all neo-button", filterMode === 'week' && selectedRange !== 'All' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700")}
              >
                Tuần này
              </button>
              <button 
                onClick={() => setQuickFilter('month')}
                className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all neo-button", filterMode === 'month' && selectedRange !== 'All' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700")}
              >
                Tháng này
              </button>
              <button 
                onClick={() => setSelectedRange('All')}
                className={cn("flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all neo-button", selectedRange === 'All' ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700")}
              >
                Tất cả
              </button>
            </div>

            <select 
              className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
            >
              <option value="All">Toàn bộ thời gian</option>
              {availableRanges.map(range => <option key={range} value={range}>{range}</option>)}
            </select>
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            {(userRole === 'ADMIN' || userRole === 'TASKFORCE') && onNavigate && (
                <button
                    onClick={() => onNavigate('record')}
                    className={cn("flex-1 sm:flex-none px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl neo-button", userRole === 'TASKFORCE' ? "bg-amber-500 text-white shadow-amber-200" : "bg-blue-600 text-white shadow-blue-200")}
                >
                    <PlusCircle className="w-5 h-5" />
                    <span>Ghi nhận Vi phạm</span>
                </button>
            )}
            {userRole !== 'TASKFORCE' && (
              <button
                  onClick={() => setShowMonitorPortal(true)}
                  className="flex-1 sm:flex-none px-6 py-3 bg-purple-600 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-200 neo-button"
              >
                  <BookOpen className="w-5 h-5" />
                  <span>Sổ Đầu Bài</span>
              </button>
            )}
            <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-sm neo-button"
            >
                <FileOutput className="w-5 h-5 text-emerald-600" />
                <span>Xuất CSV</span>
            </button>
            {userRole === 'ADMIN' && onToggleGoodStudyWeek && (
              <button
                onClick={() => onToggleGoodStudyWeek(!isGoodStudyWeek)}
                className={cn(
                  "flex-1 sm:flex-none px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xl neo-button",
                  isGoodStudyWeek ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-white border border-slate-200 text-slate-500"
                )}
              >
                <Sparkles className={cn("w-5 h-5", isGoodStudyWeek ? "text-white" : "text-emerald-500")} />
                <span>Tuần học tốt {isGoodStudyWeek ? '(Đang bật)' : ''}</span>
              </button>
            )}
        </div>
      </div>

      {/* Admin School Overview */}
      {userRole === 'ADMIN' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-4 gap-6"
        >
          <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-full -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-110" />
            <div className="relative z-10">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Lớp dẫn đầu tuần này</h4>
              <div className="flex items-end gap-4">
                <div className="text-5xl font-black text-slate-800 tracking-tighter font-display">
                  {barChartData[0]?.name || 'N/A'}
                </div>
                <div className="mb-1 flex items-center gap-1 text-emerald-600 font-black text-xs bg-emerald-50 px-2 py-1 rounded-lg">
                  <TrendingUp className="w-3 h-3" />
                  Top 1
                </div>
              </div>
              <p className="text-sm text-slate-500 font-bold mt-4">Duy trì phong độ tốt với 100% tiết học loại A và không có vi phạm nghiêm trọng.</p>
            </div>
            <div className="mt-8 flex gap-2">
              <button 
                onClick={() => onNavigate?.('ranking')}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all neo-button"
              >
                Xem chi tiết BXH
              </button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden group border-rose-100">
             <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50/50 rounded-full -mr-6 -mt-6 transition-transform duration-700 group-hover:scale-110" />
             <div className="relative z-10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Cảnh báo nề nếp</h4>
                <div className="text-4xl font-black text-rose-600 tracking-tighter mb-2 font-display">
                  {filteredViolations.filter(v => ['Tiết D', 'Vô lễ GV', 'Đánh nhau/đe dọa/quay phim'].includes(v.type)).length}
                </div>
                <p className="text-xs font-bold text-slate-500">Vi phạm nghiêm trọng cần xử lý ngay trong tuần này.</p>
             </div>
             <div className="mt-6">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full w-2/3" />
                </div>
             </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] flex flex-col justify-between relative overflow-hidden group border-emerald-100">
             <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-50/50 rounded-full -mt-10 -ml-10 blur-2xl" />
             <div className="relative z-10">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Gương người tốt</h4>
               <div className="text-4xl font-black text-emerald-600 tracking-tighter mb-2 font-display">
                 {goodDeeds}
               </div>
               <p className="text-xs font-bold text-slate-500">Lượt tuyên dương và việc tốt được ghi nhận.</p>
             </div>
             <div className="mt-6 flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-600">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                  +{goodDeeds > 4 ? goodDeeds - 4 : 0}
                </div>
             </div>
          </div>
        </motion.div>
      )}

      {/* GVCN Specific View */}
      {userRole === 'TEACHER' && currentUser?.assignedClass && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-2">Chào Thầy/Cô, GVCN Lớp {currentUser.assignedClass}</h2>
              <p className="text-blue-100 text-sm font-bold opacity-80">Theo dõi tình hình nề nếp và thi đua của lớp mình trong tuần này.</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/30 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Vi phạm tuần</p>
                <p className="text-2xl font-black">{filteredViolations.filter(v => v.className === currentUser.assignedClass && v.points < 0).length}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/30 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Điểm cộng tuần</p>
                <p className="text-2xl font-black">+{filteredViolations.filter(v => v.className === currentUser.assignedClass && v.points > 0).length}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid - Bento Style */}
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: 'Tổng học sinh', value: students.length, icon: Users, color: 'blue', trend: '+2 tuần này' },
          { label: 'Số lỗi đã lọc', value: totalViolations - goodDeeds, icon: AlertTriangle, color: 'rose', trend: '-12% so với tuần trước' },
          { label: 'Sổ đầu bài', value: filteredViolations.filter(v => v.recordedRole === 'MONITOR').length, icon: BookOpen, color: 'purple', trend: 'Đã hoàn thành' },
          { label: 'Điểm TB Nề nếp', value: averageScore.toFixed(1), icon: LineChart, color: 'indigo', trend: 'Ổn định' },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            variants={itemVariants} 
            className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-2xl shadow-sm border border-white transition-transform duration-500 group-hover:scale-110", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg uppercase tracking-wider">{stat.trend}</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{stat.label}</p>
              <h3 className="text-3xl font-light text-slate-900 tracking-tight">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Policy & Rules Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-xl"><ShieldAlert className="w-5 h-5 text-amber-400" /></div>
              <h3 className="text-lg font-black tracking-tight">Lưu ý Quy định 2025-2026</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-amber-400">01</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    Lớp có học sinh vi phạm <span className="text-white font-black">Điều cấm</span> sẽ bị <span className="text-rose-400 font-black">hạ một bậc</span> xếp loại thi đua (Tuần/Tháng/Kỳ).
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-blue-400">02</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    Trong <span className="text-blue-400 font-black">Tuần học tốt</span>, tất cả các điểm cộng và điểm trừ nề nếp sẽ được <span className="text-white font-black">nhân đôi (x2)</span>.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-emerald-400">03</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    Xếp loại <span className="text-emerald-400 font-black">TỐT</span> yêu cầu điểm thi đua <span className="text-white font-black">≥ 200đ</span> và không có vi phạm điều cấm.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-purple-400">04</span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed">
                    Học sinh vi phạm hệ thống hoặc điều cấm sẽ bị xử lý <span className="text-white font-black">Lao động trường</span> theo quy định.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Info className="w-5 h-5" /></div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Phân hạng Thi đua</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Hạng TỐT', range: '≥ 200đ', color: 'emerald' },
                { label: 'Hạng KHÁ', range: '180 - 200đ', color: 'blue' },
                { label: 'Hạng ĐẠT', range: '150 - 180đ', color: 'amber' },
                { label: 'CHƯA ĐẠT', range: '< 150đ', color: 'rose' },
              ].map((rank, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider", `text-${rank.color}-600`)}>{rank.label}</span>
                  <span className="text-xs font-black text-slate-700">{rank.range}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold italic mt-4">* Điểm chuẩn căn cứ trên 200đ gốc mỗi tuần.</p>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><TrendingUp className="w-4 h-4" /></div>
              Xu hướng nề nếp
            </h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vi phạm</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tuyên dương</span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                   <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRewards" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                  itemStyle={{fontSize: '11px', fontWeight: 'bold'}}
                  labelStyle={{fontSize: '10px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'black'}}
                />
                <Area type="monotone" dataKey="violations" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorViolations)" />
                <Area type="monotone" dataKey="rewards" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRewards)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[450px]">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600"><Database className="w-4 h-4" /></div>
            Nguồn dữ liệu
          </h3>
          <div className="flex-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceChartData} cx="50%" cy="50%" innerRadius={75} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {sourceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng cộng</p>
              <p className="text-3xl font-light text-slate-900">{totalViolations}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-white p-8 rounded-3xl shadow-[0_2px_8_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><Clock className="w-4 h-4" /></div>
            Hoạt động gần đây
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {filteredViolations.slice().reverse().slice(0, 10).map((v, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 hover:bg-slate-50/80 transition-all group cursor-default">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[11px] shadow-sm border border-white shrink-0", v.points < 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                  {v.points > 0 ? '+' : ''}{v.points}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate">{v.studentName}</p>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{v.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                    <span className={cn("font-bold mr-1.5", v.points < 0 ? "text-rose-500" : "text-emerald-500")}>{v.type}</span>
                    {v.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="bg-white p-8 rounded-3xl shadow-[0_2px_8_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><TrendingUp className="w-4 h-4" /></div>
            Top 10 lớp vi phạm
          </h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} width={60} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="violations" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={16}>
                   {barChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index < 3 ? '#3b82f6' : '#cbd5e1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* New Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.8 }}
          className="bg-white p-8 rounded-3xl shadow-[0_2px_8_rgba(0,0,0,0.04)] border border-slate-100/80 h-[450px] flex flex-col"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><AlertTriangle className="w-4 h-4" /></div>
            Cơ cấu loại vi phạm
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={violationTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {violationTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-[9px] font-bold text-slate-500 uppercase">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.9 }}
          className="bg-white p-8 rounded-3xl shadow-[0_2px_8_rgba(0,0,0,0.04)] border border-slate-100/80 h-[450px] flex flex-col"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Users className="w-4 h-4" /></div>
            Phân bổ điểm số học sinh
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistributionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                  {scoreDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 1.0 }}
          className="bg-white p-8 rounded-3xl shadow-[0_2px_8_rgba(0,0,0,0.04)] border border-slate-100/80 h-[450px] flex flex-col"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Sparkles className="w-4 h-4" /></div>
            So sánh Top 5 Lớp
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={classRadarData}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis dataKey="subject" tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Chỉ số thi đua"
                  dataKey="A"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.6}
                />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-[9px] font-bold text-slate-400 uppercase">Điểm trung bình</span>
            </div>
          </div>
        </motion.div>
      </div>

      {showMonitorPortal && onAddRecord && (
        <ClassMonitorPortal 
          students={students} 
          violations={violations}
          onAddRecord={onAddRecord} 
          onClose={() => setShowMonitorPortal(false)} 
          currentUser={currentUser} 
        />
      )}
    </div>
  );
};

export default Dashboard;
