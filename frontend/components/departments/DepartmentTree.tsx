import React, { useEffect, useState } from 'react';
import { useDepartmentStore } from '../../store/departmentStore';
import { DepartmentHierarchy } from '../../services/department.service';

interface DepartmentTreeProps {
  organizationId: string;
  onEdit?: (department: DepartmentHierarchy) => void;
  onDelete?: (id: string) => void;
}

interface TreeNodeProps {
  node: DepartmentHierarchy;
  onEdit?: (department: DepartmentHierarchy) => void;
  onDelete?: (id: string) => void;
  level?: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onEdit, onDelete, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition ${
          level > 0 ? 'ml-8' : ''
        }`}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded ${
            hasChildren
              ? 'text-gray-600 hover:bg-gray-200'
              : 'text-transparent cursor-default'
          }`}
          disabled={!hasChildren}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 transform transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Department Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          node.isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>

        {/* Department Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{node.name}</h4>
            {node.code && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {node.code}
              </span>
            )}
            {!node.isActive && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded font-medium">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            {node.manager && (
              <span>
                Manager: {node.manager.firstName} {node.manager.lastName}
              </span>
            )}
            <span>{node._count?.employees || 0} employees</span>
            {hasChildren && (
              <span>{node.children.length} sub-departments</span>
            )}
          </div>
          {node.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-1">{node.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Edit department"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete department"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-2 border-l-2 border-gray-200">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DepartmentTree: React.FC<DepartmentTreeProps> = ({
  organizationId,
  onEdit,
  onDelete,
}) => {
  const { hierarchy, loading, error, fetchHierarchy } = useDepartmentStore();

  useEffect(() => {
    if (organizationId) {
      fetchHierarchy(organizationId);
    }
  }, [organizationId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading hierarchy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Departments Yet</h3>
        <p className="text-gray-600">Create your first department to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hierarchy.map((node) => (
        <TreeNode key={node.id} node={node} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default DepartmentTree;
