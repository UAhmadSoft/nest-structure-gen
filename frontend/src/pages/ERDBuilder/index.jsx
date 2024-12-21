// src/pages/ERDBuilder/index.jsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState
} from 'reactflow';
import { TableNode } from '../../components/custom/TableNode';
import { TableDialog } from '../../components/custom/TableDialog';
import { ColumnDialog } from '../../components/custom/ColumnDialog';
import { RelationDialog } from '../../components/custom/RelationDialog';
import { Button } from '../../components/ui/button';
import 'reactflow/dist/style.css';
import { DeleteConfirmDialog } from '../../components/custom/DeleteConfirmDialog';
import { TableNameEdit } from '../../components/custom/TableNameEdit';
import { validateSchema } from '../../utils/schemaValidation';
import { MiniMap } from 'reactflow';
import { SchemaImport } from '../../components/custom/SchemaImport';
import { schemaToNodes } from '../../utils/schemaConverter';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { UndoRedo } from '../../components/custom/UndoRedo';
import { LayoutControls } from '../../components/custom/LayoutControls';
import { getLayoutedElements } from '../../utils/layoutUtils';
import { useHotkeys } from 'react-hotkeys-hook';
import { SearchBar } from '../../components/custom/SearchBar';
import { FilterPanel } from '../../components/custom/FilterPanel';
import { CustomEdge } from '../../components/custom/CustomEdges';
import { ThemeCustomizer } from '../../components/custom/ThemeCustomizer';
import { ExportImage } from '../../components/custom/ExportImage';
import { DEFAULT_THEME } from '../../config/theme';
import { GroupNode } from '../../components/custom/GroupNode';
import { GroupDialog } from '../../components/custom/GroupDialog';
import { storageService } from '../../services/storage';
import { Tutorial } from '../../components/custom/Tutorial';
import { ShortcutsGuide } from '../../components/custom/ShortcutsGuide';
import { useKeyboardShortcuts } from '../../utils/shortcuts';
import ErrorBoundary from '../../components/custom/ErrorBoundary';
import { LoadingState } from '../../components/custom/LoadingStates';
import { ConfigDialog } from '../../components/custom/ConfigDialog';
const edgeTypes = {
  custom: CustomEdge,
};

// Wrap the main content in ReactFlowProvider
export function ERDBuilderWrapper() {
  return (
    <ReactFlowProvider>
      <ERDBuilder />
    </ReactFlowProvider>
  );
}

export function ERDBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isRelationDialogOpen, setIsRelationDialogOpen] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, data: null });
  const [validationErrors, setValidationErrors] = useState([])
  const { setNodes: setReactFlowNodes, setEdges: setReactFlowEdges } = useReactFlow();
  const { undo, redo } = useReactFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState(['OneToMany', 'ManyToOne', 'OneToOne', 'ManyToMany']);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddTable = (table) => {
    const position = { x: Math.random() * 500, y: Math.random() * 500 };
    const newNode = {
      id: table.name,
      type: 'tableNode',
      position,
      data: { ...table, columns: [], relations: [] }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddColumn = (column) => {
    if (!selectedTable) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedTable) {
          return {
            ...node,
            data: {
              ...node.data,
              columns: [...node.data.columns, column]
            }
          };
        }
        return node;
      })
    );
  };

  const handleAddRelation = (relation) => {
    // Add relation to source table
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === relation.sourceTable) {
          return {
            ...node,
            data: {
              ...node.data,
              relations: [
                ...(node.data.relations || []),
                {
                  name: relation.targetTable,
                  type: relation.type,
                  required: relation.required
                }
              ]
            }
          };
        }
        return node;
      })
    );

    // Create edge with custom styling
    const newEdge = {
      id: `${relation.sourceTable}-${relation.targetTable}`,
      source: relation.sourceTable,
      target: relation.targetTable,
      type: 'custom',
      data: {
        relationType: relation.type,
        label: relation.type
      },
      animated: true
    };
    setEdges((eds) => [...eds, newEdge]);
  };

  const exportSchema = () => {
    const schema = generateSchema(nodes, projectPath);
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditColumn = (index, column) => {
    setEditingColumn({ ...column, index });
    setIsColumnDialogOpen(true);
  };

  const handleUpdateColumn = (updatedColumn) => {
    if (!selectedTable) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedTable) {
          const newColumns = [...node.data.columns];
          newColumns[editingColumn.index] = updatedColumn;
          return {
            ...node,
            data: {
              ...node.data,
              columns: newColumns
            }
          };
        }
        return node;
      })
    );
    setEditingColumn(null);
  };

  const handleDeleteColumn = (index) => {
    setDeleteConfirm({
      isOpen: true,
      data: { type: 'column', index }
    });
  };

  const confirmDelete = () => {
    if (!selectedTable || !deleteConfirm.data) return;

    if (deleteConfirm.data.type === 'column') {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedTable) {
            const newColumns = [...node.data.columns];
            newColumns.splice(deleteConfirm.data.index, 1);
            return {
              ...node,
              data: {
                ...node.data,
                columns: newColumns
              }
            };
          }
          return node;
        })
      );
    }

    setDeleteConfirm({ isOpen: false, data: null });
  };

  const handleTableNameEdit = (newName) => {
    if (!selectedTable) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedTable) {
          return {
            ...node,
            id: newName,
            data: {
              ...node.data,
              name: newName
            }
          };
        }
        return node;
      })
    );

    // Update edges
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === selectedTable) {
          return { ...edge, source: newName };
        }
        if (edge.target === selectedTable) {
          return { ...edge, target: newName };
        }
        return edge;
      })
    );

    setSelectedTable(newName);
  };

  const handleExport = () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Validating and exporting schema...');
      const errors = validateSchema(nodes);
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      if (!projectPath) {
        setIsConfigOpen(true);
        return;
      }

      exportSchema();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchemaImport = (schema) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Importing schema...');
      // Save project path from schema
      setProjectPath(schema.url);

      // Convert schema to nodes and edges
      const { nodes: newNodes, edges: newEdges } = schemaToNodes(schema);
      setNodes(newNodes);
      setEdges(newEdges);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcuts
  useHotkeys('ctrl+s', (e) => {
    e.preventDefault();
    handleExport();
  }, {}, [handleExport]);

  useHotkeys('ctrl+o', (e) => {
    e.preventDefault();
    document.querySelector('input[type="file"]')?.click();
  }, {}, []);

  useHotkeys('delete', () => {
    if (selectedTable) {
      setDeleteConfirm({
        isOpen: true,
        data: { type: 'table', id: selectedTable }
      });
    }
  }, {}, [selectedTable]);

  const handleLayout = (direction = 'TB') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      direction
    );

    setReactFlowNodes(layoutedNodes);
    setReactFlowEdges(layoutedEdges);
  };

  // Add to existing hotkeys
  useHotkeys('ctrl+z', (e) => {
    e.preventDefault();
    undo();
  }, {}, [undo]);

  useHotkeys('ctrl+y', (e) => {
    e.preventDefault();
    redo();
  }, {}, [redo]);

  // Filter nodes based on search
  const filteredNodes = nodes.filter((node) =>
    node.data.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter edges based on relation types
  const filteredEdges = edges.filter((edge) =>
    activeFilters.includes(edge.data?.relationType)
  );

  // Load saved state
  useEffect(() => {
    const savedState = storageService.loadState();
    if (savedState) {
      setNodes(savedState.nodes);
      setEdges(savedState.edges);
      setTheme(savedState.theme);
    }
  }, []);

  // Save state on changes
  useEffect(() => {
    storageService.saveState({
      nodes,
      edges,
      theme
    });
  }, [nodes, edges, theme]);

  const handleAddGroup = () => {
    setEditingGroup(null);
    setIsGroupDialogOpen(true);
  };

  const handleSaveGroup = (groupData) => {
    if (editingGroup) {
      // Update existing group
      setNodes((nds) =>
        nds.map((node) =>
          node.type === 'group' && node.id === editingGroup.id
            ? { ...node, data: { ...node.data, ...groupData } }
            : node
        )
      );
    } else {
      // Add new group
      const newGroup = {
        id: `group-${Date.now()}`,
        type: 'group',
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        data: {
          ...groupData,
          onDrop: (nodeType) => handleNodeDrop(nodeType, newGroup.id)
        }
      };
      setNodes((nds) => [...nds, newGroup]);
    }
  };

  const handleNodeDrop = (nodeId, groupId) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, parentNode: groupId }
          : node
      )
    );
  };

  // In ERDBuilder.jsx, update the nodeTypes:
  const nodeTypes = useMemo(() => ({
    tableNode: (props) => (
      <TableNode
        {...props}
        theme={theme}
        onEditColumn={handleEditColumn}
        onDeleteColumn={handleDeleteColumn}
        onEditRelation={(index, relation) => {
          // Add relation editing logic here
          console.log('Edit relation:', index, relation);
        }}
        onDeleteRelation={(index) => {
          // Add relation deletion logic here
          console.log('Delete relation:', index);
        }}
      />
    ),
    group: GroupNode
  }), [theme, handleEditColumn, handleDeleteColumn]);

  // Setup keyboard shortcuts
  const shortcutHandlers = {
    save: handleExport,
    undo: undo,
    redo: redo,
    group: () => setIsGroupDialogOpen(true),
    search: () => document.querySelector('.search-input')?.focus(),
    delete: handleDeleteColumn,
    deselect: () => setSelectedTable(null),
  };

  useKeyboardShortcuts(shortcutHandlers);

  // Inside ERDBuilder.jsx
  return (
    <ErrorBoundary>
      <LoadingState loading={isLoading} message={loadingMessage}>
        <div className="flex flex-col h-screen">
          {/* Top Navigation */}
          <div className="bg-white border-b p-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">NestJS Schema Generator</h1>
              <div className="flex items-center gap-4 tools-section">
                <Tutorial />
                <ShortcutsGuide />
                <ThemeCustomizer theme={theme} onThemeChange={setTheme} />
                <ExportImage />
                <UndoRedo />
                <LayoutControls onLayout={handleLayout} />
                <div className="space-x-2 export-section">
                  <Button onClick={handleAddGroup}>Add Group</Button>
                  <SchemaImport onImport={handleSchemaImport} />
                  <Button onClick={() => setIsConfigOpen(true)}>
                    Configure Project
                  </Button>
                  <Button onClick={handleExport} variant="default">
                    Export Schema
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 p-4">
              <h3 className="text-red-800 font-medium mb-2">Validation Errors:</h3>
              <ul className="list-disc pl-5">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-red-700">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Content */}
          <div className="flex flex-1">
            {/* Left Sidebar - Table Management */}
            <div className="w-64 border-r p-4 bg-white table-list">
              <div className="mb-4">
                <SearchBar onSearch={setSearchTerm} />
              </div>
              <div class name="add-table-btn">
                <TableDialog onAddTable={handleAddTable} />
              </div>
              <div className="mt-4">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`p-2 cursor-pointer hover:bg-gray-100 rounded ${selectedTable === node.id ? 'bg-blue-50' : ''
                      }`}
                    onClick={() => setSelectedTable(node.id)}
                  >
                    {node.data.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Main ERD Area */}
            <div className="flex-1 erd-area">
              <ReactFlow
                nodes={filteredNodes}
                edges={filteredEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>

            {/* Right Sidebar - Properties */}
            {/* Update right sidebar */}
            <div className="w-64 border-l p-4 bg-white properties-panel">
              {selectedTable && (
                <>
                  <TableNameEdit
                    name={nodes.find(n => n.id === selectedTable)?.data.name}
                    onEdit={handleTableNameEdit}
                  />
                  <div className="w-64 border-l p-4 bg-white">
                    {selectedTable && (
                      <>
                        <h2 className="text-lg font-bold mb-4">
                          {nodes.find(n => n.id === selectedTable)?.data.name}
                        </h2>
                        <div className="space-y-2">
                          <Button
                            onClick={() => setIsColumnDialogOpen(true)}
                            className="w-full"
                          >
                            Add Column
                          </Button>
                          <Button
                            onClick={() => setIsRelationDialogOpen(true)}
                            className="w-full"
                          >
                            Add Relation
                          </Button>
                        </div>

                        {/* Show columns */}
                        <div className="mt-4">
                          <h3 className="font-medium mb-2">Columns</h3>
                          {nodes
                            .find(n => n.id === selectedTable)
                            ?.data.columns.map((column, index) => (
                              <div
                                key={index}
                                className="text-sm p-2 bg-gray-50 rounded mb-1"
                              >
                                {column.name} ({column.type})
                              </div>
                            ))}
                        </div>

                        {/* Show relations */}
                        <div className="mt-4">
                          <h3 className="font-medium mb-2">Relations</h3>
                          {nodes
                            .find(n => n.id === selectedTable)
                            ?.data.relations?.map((relation, index) => (
                              <div
                                key={index}
                                className="text-sm p-2 bg-gray-50 rounded mb-1"
                              >
                                {relation.name} ({relation.type})
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-4">
                    <FilterPanel
                      activeFilters={activeFilters}
                      onFilterChange={setActiveFilters}
                    />
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Dialogs */}
          <ColumnDialog
            isOpen={isColumnDialogOpen}
            onClose={() => {
              setIsColumnDialogOpen(false);
              setEditingColumn(null);
            }}
            onAddColumn={handleAddColumn}
            editingColumn={editingColumn}
            onEditColumn={handleUpdateColumn}
          />

          <GroupDialog
            isOpen={isGroupDialogOpen}
            onClose={() => {
              setIsGroupDialogOpen(false);
              setEditingGroup(null);
            }}
            onSave={handleSaveGroup}
            initialData={editingGroup?.data}
          />

          <DeleteConfirmDialog
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ isOpen: false, data: null })}
            onConfirm={confirmDelete}
            title="Delete Column"
            description="Are you sure you want to delete this column? This action cannot be undone."
          />
          <RelationDialog
            isOpen={isRelationDialogOpen}
            onClose={() => setIsRelationDialogOpen(false)}
            tables={nodes}
            sourceTable={selectedTable}
            onAddRelation={handleAddRelation}
          />
          <ConfigDialog
            isOpen={isConfigOpen}
            onClose={() => setIsConfigOpen(false)}
            onSave={setProjectPath}
          />
        </div>
      </LoadingState>
    </ErrorBoundary>
  );
}