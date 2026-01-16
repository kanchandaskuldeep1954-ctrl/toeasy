import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface UsageMetrics {
  api_calls_today: number;
  api_calls_this_month: number;
  api_calls_limit: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  datasets_created: number;
  datasets_limit: number;
  queries_executed: number;
  validations_run: number;
  rows_processed: number;
  api_calls_trend: Array<{ date: string; calls: number }>;
  storage_trend: Array<{ date: string; used_gb: number }>;
  feature_usage: Array<{ feature: string; count: number }>;
}

const UsageMetrics: React.FC = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('month');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadMetrics();
  }, [token, timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${backendUrl}/users/me/usage-metrics`,
        {
          params: { range: timeRange },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setMetrics(response.data);
    } catch (err) {
      setError('Failed to load usage metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!metrics) {
    return (
      <div className="p-8 text-center text-slate-400">
        {loading ? 'Loading metrics...' : error || 'No metrics available'}
      </div>
    );
  }

  const apiCallsPercent = Math.round((metrics.api_calls_this_month / metrics.api_calls_limit) * 100);
  const storagePercent = Math.round((metrics.storage_used_gb / metrics.storage_limit_gb) * 100);
  const datasetsPercent = Math.round((metrics.datasets_created / metrics.datasets_limit) * 100);

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-6 p-4 overflow-auto">
      
      {/* Header */}
      <div className="flex justify-between items-start gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Usage Metrics</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Monitor your API usage and subscription limits</p>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
          {(['day', 'week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase transition-all ${
                timeRange === range
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {range === 'day' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* API Calls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">API Calls</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-2xl font-black text-indigo-600">{metrics.api_calls_this_month.toLocaleString()}</p>
              <p className="text-[8px] text-slate-500 mt-1">/ {metrics.api_calls_limit.toLocaleString()}</p>
            </div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{apiCallsPercent}%</div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(apiCallsPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Storage</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-2xl font-black text-cyan-600">{metrics.storage_used_gb.toFixed(2)} GB</p>
              <p className="text-[8px] text-slate-500 mt-1">/ {metrics.storage_limit_gb.toFixed(0)} GB</p>
            </div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{storagePercent}%</div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-600 transition-all"
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Datasets */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Datasets</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-2xl font-black text-emerald-600">{metrics.datasets_created}</p>
              <p className="text-[8px] text-slate-500 mt-1">/ {metrics.datasets_limit}</p>
            </div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{datasetsPercent}%</div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(datasetsPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Today's Calls */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Today's Calls</p>
          <p className="text-2xl font-black text-amber-600">{metrics.api_calls_today}</p>
          <p className="text-[8px] text-slate-500 mt-2">24-hour count</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* API Calls Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">API Calls Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.api_calls_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#4f46e5"
                dot={{ fill: '#4f46e5' }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Storage Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Storage Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.storage_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="used_gb" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Usage */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Feature Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.feature_usage}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, count }) => `${name}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {metrics.feature_usage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Summary */}
        <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Activity Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">Queries Executed</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{metrics.queries_executed.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">Validations Run</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{metrics.validations_run.toLocaleString()}</p>
            </div>
            <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">Rows Processed</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{metrics.rows_processed.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageMetrics;
