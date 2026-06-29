import React from 'react';
import { Card, CardBody } from './Card';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard = React.memo(function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <Card className={`text-white ${color} border-none shadow-lg shadow-gray-200`}>
      <CardBody className="flex items-center gap-4 py-4">
        <div className="p-3 bg-white/20 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-white/80 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
});

export default StatCard;
