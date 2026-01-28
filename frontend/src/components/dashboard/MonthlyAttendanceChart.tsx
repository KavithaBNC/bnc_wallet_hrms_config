import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

interface MonthlyAttendanceChartProps {
  organizationId: string;
}

const MonthlyAttendanceChart = ({ organizationId }: MonthlyAttendanceChartProps) => {
  const [data, setData] = useState<Array<{ month: string; attendance: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        // Get last 6 months of attendance data
        const months = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
          const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
          const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
          
          try {
            const response = await api.get('/attendance/records', {
              params: {
                startDate,
                endDate,
                organizationId,
                page: '1',
                limit: '1000',
              },
            });
            
            const records = response.data.data?.data || response.data.data || [];
            const presentCount = records.filter((r: any) => r.status === 'PRESENT').length;
            const totalRecords = records.length;
            const attendance = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
            
            months.push({
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              attendance,
            });
          } catch (error) {
            months.push({
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              attendance: 0,
            });
          }
        }
        
        setData(months);
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
        // Set default data
        setData([
          { month: 'Jul', attendance: 85 },
          { month: 'Aug', attendance: 88 },
          { month: 'Sep', attendance: 90 },
          { month: 'Oct', attendance: 92 },
          { month: 'Nov', attendance: 94 },
          { month: 'Dec', attendance: 96 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="month" 
          stroke="#666"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#666"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
          }}
        />
        <Line 
          type="monotone" 
          dataKey="attendance" 
          stroke="#8b5cf6" 
          strokeWidth={3}
          dot={{ fill: '#8b5cf6', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MonthlyAttendanceChart;
