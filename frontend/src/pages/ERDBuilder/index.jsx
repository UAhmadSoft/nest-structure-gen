// src/pages/ERDBuilder/index.jsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState
} from 'reactflow';
import { TableNode } from '../../components/custom/TableNode';
import { ColumnDialog } from '../../components/custom/ColumnDialog';
import { RelationDialog } from '../../components/custom/RelationDialog';
import { Button } from '../../components/ui/button';
import 'reactflow/dist/style.css';
import { DeleteConfirmDialog } from '../../components/custom/DeleteConfirmDialog';
import { TableNameEdit } from '../../components/custom/TableNameEdit';
import { validateSchema } from '../../utils/schemaValidation';
import { MiniMap } from 'reactflow';
import { schemaToNodes } from '../../utils/schemaConverter';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { getLayoutedElements } from '../../utils/layoutUtils';
import { useHotkeys } from 'react-hotkeys-hook';
import { FilterPanel } from '../../components/custom/FilterPanel';
import { CustomEdge } from '../../components/custom/CustomEdges';
import { DEFAULT_THEME } from '../../config/theme';
import { GroupNode } from '../../components/custom/GroupNode';
import { GroupDialog } from '../../components/custom/GroupDialog';
import { storageService } from '../../services/storage';
import { useKeyboardShortcuts } from '../../utils/shortcuts';
import ErrorBoundary from '../../components/custom/ErrorBoundary';
import { LoadingState } from '../../components/custom/LoadingStates';
import { ConfigDialog } from '../../components/custom/ConfigDialog';
import {
  Clock,
  Keyboard,
  Layout,
  Folder,
  Upload,
  Settings,
  Download,
  Search
} from 'lucide-react';
import { Tutorial } from '../../components/custom/Tutorial';
import { ShortcutsGuide } from '../../components/custom/ShortcutsGuide';
import { TableDialog } from '../../components/custom/TableDialog';
import { generateSchema } from '../../utils/schemaGenerator';
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
  const [editingRelation, setEditingRelation] = useState();
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
  const isFirstRender = useRef(true);

  // Load data from localStorage when the component mounts
  useEffect(() => {
    const savedNodes = localStorage.getItem('nodes');
    const savedEdges = localStorage.getItem('edges');
    const savedProjectPath = localStorage.getItem('projectPath');

    if (savedNodes) {
      setNodes(JSON.parse(savedNodes));
    }
    if (savedEdges) {
      setEdges(JSON.parse(savedEdges));
    }
    if (savedProjectPath) {
      setProjectPath(savedProjectPath);
    }
  }, [])



  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleDeleteTable = useCallback(() => {
    if (selectedTable) {
      setDeleteConfirm({
        isOpen: true,
        data: { type: 'table', id: selectedTable }
      });
    }
  }, [selectedTable]);

  const handleAddTable = (table) => {
    // if table already exists, return
    if (nodes.find((node) => node.id === table.name)) return;
    const position = { x: Math.random() * 500, y: Math.random() * 500 };
    const newNode = {
      id: table.name,
      type: 'tableNode',
      position,
      data: { ...table, columns: [], relations: [] }
    };
    setNodes((nds) => [...nds, newNode]);
    setTimeout(() => {
      setSelectedTable(table.name);
    }, 500);
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
    // If relation already exists, update it
    console.log('relation23', relation)
    const alreadyRelation = nodes.find((node) =>
      node.data.relations?.find((rel) => rel.id === relation.id)
    );
    if (alreadyRelation) {
      if (relation.type === 'OneToMany' || relation.type === 'OneToOne' || relation.type === 'ManyToMany') {
        const reverseName = relation.type === 'OneToMany' ? 'ManyToOne' : relation.type;

        let newNodes = nodes.map((node) => {
          if (node.id === relation.targetTable) {
            return {
              ...node,
              data: {
                ...node.data,
                relations: [
                  ...(node.data.relations || []),
                  {
                    name: relation.sourceTable,
                    type: reverseName,
                    required: relation.required,
                    id: `${relation.targetTable}-${relation.sourceTable}` // Unique ID for relation
                  }
                ]
              }
            };
          }
          return node;
        });

        newNodes = Array.from(new Set([...newNodes, alreadyRelation]));

        // Create edge with custom styling
        const newEdge = {
          id: `${relation.targetTable}-${relation.sourceTable}`,
          source: relation.targetTable,
          target: relation.sourceTable,
          type: reverseName,
          data: {
            relationType: reverseName,
            label: reverseName
          },
          animated: true
        };

        let newEdges = Array.from(new Set([...edges, newEdge]));

        setNodes(newNodes.map((node) => {
          return {
            ...node,
            data: {
              ...node.data,
              relations: node.data.relations.map((rel) => {
                console.log('rel.id', rel.id)
                console.log('relation.id', relation.id)
                if (rel.id === relation.id) {
                  return relation;
                }
                return rel;
              })
            }
          }
        }
        ));

        // Update edge with custom styling
        setEdges(newEdges.map((edge) => {
          if (edge.id === relation.id) {
            return {
              ...edge,
              data: {
                relationType: relation.type,
                label: relation.type
              }
            };
          }
          return edge;
        })
        );

        setEditingRelation(undefined)
      }

    }
    else {
      let newNodes = [...nodes];
      let newEdges = [...edges];
      if (relation.type === 'OneToMany' || relation.type === 'OneToOne' || relation.type === 'ManyToMany') {
        const reverseName = relation.type === 'OneToMany' ? 'ManyToOne' : relation.type;

        newNodes = newNodes.map((node) => {
          if (node.id === relation.targetTable) {
            return {
              ...node,
              data: {
                ...node.data,
                relations: [
                  ...(node.data.relations || []),
                  {
                    name: relation.sourceTable,
                    type: reverseName,
                    required: relation.required,
                    id: `${relation.targetTable}-${relation.sourceTable}` // Unique ID for relation
                  }
                ]
              }
            };
          }
          return node;
        });

        // Create edge with custom styling
        const newEdge = {
          id: `${relation.targetTable}-${relation.sourceTable}`,
          source: relation.targetTable,
          target: relation.sourceTable,
          type: 'custom',
          data: {
            relationType: reverseName,
            label: reverseName,
          },
          animated: true
        };

        newEdges = [...newEdges, newEdge];
      }
      setNodes(
        newNodes.map((node) => {
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
                    required: relation.required,
                    id: `${relation.sourceTable}-${relation.targetTable}` // Unique ID for relation
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
      setEdges([...newEdges, newEdge]);
    }
  }

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

  const handleEditColumn = useCallback((index, column) => {
    setEditingColumn({ ...column, index });
    setIsColumnDialogOpen(true);
  }, []);

  const handleDeleteColumn = useCallback((index) => {
    setDeleteConfirm({
      isOpen: true,
      data: { type: 'column', index }
    });
  }, []);

  const handleNodeClick = (event, node) => {
    setSelectedTable(node.id);
  };

  const confirmDelete = () => {
    console.log("deleteConfirm", deleteConfirm)
    if (!deleteConfirm.data) return;

    if (deleteConfirm.data.type === 'column') {
      if (!selectedTable) return;
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
    } else if (deleteConfirm.data.type === 'table') {
      let newNodes = [...nodes];
      let newEdges = [...edges];
      newNodes = newNodes.filter((node) => node.id !== deleteConfirm.data.id)
      newEdges = newEdges.filter((edge) => edge.source !== deleteConfirm.data.id && edge.target !== deleteConfirm.data.id)
      // delete all relations and edges related to the table
      newNodes = newNodes.map((node) => {
        return {
          ...node,
          data: {
            ...node.data,
            relations: node.data.relations.filter((rel) => rel.name !== deleteConfirm.data.id)
          }
        };
      });

      setNodes(newNodes);

      newEdges = newEdges.filter((edge) => edge.source !== deleteConfirm.data.id && edge.target !== deleteConfirm.data.id)
      setEdges(newEdges);

      setSelectedTable(null);
    } else if (deleteConfirm.data.type === 'relation') {
      setNodes((nds) =>
        nds.map((node) => {
          return {
            ...node,
            data: {
              ...node.data,
              relations: node.data.relations.filter((rel) => rel.id !== deleteConfirm.data.relation)
            }
          };
        })
      );
      setEdges((eds) => eds.filter((edge) => edge.id !== deleteConfirm.data.relation.id));
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

  const handleLayout = useCallback((direction = 'TB') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      direction
    );

    setReactFlowNodes(layoutedNodes);
    setReactFlowEdges(layoutedEdges);
  }, [nodes, edges, setReactFlowNodes, setReactFlowEdges]);

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
  ).map((edge) => {
    return {
      ...edge,
      isSelected: true
    };
  });

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
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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

  const nodeTypes = useMemo(
    () => ({
      tableNode: (props) => (
        <TableNode
          {...props}
          theme={theme}
          onEditColumn={handleEditColumn}
          onDeleteColumn={handleDeleteColumn}
          onEditRelation={(relation) => {
            // Add relation editing logic here
            console.log('relation', relation)
            setEditingRelation(relation);
            setTimeout(() => {
              setIsRelationDialogOpen(true);
            }, 500);
            console.log('Edit relation:', relation);
          }}
          selectedTable={selectedTable}
          onDeleteRelation={(relation) => {
            // Add relation deletion logic here
            console.log('de')
            setDeleteConfirm({
              isOpen: true,
              data: { type: 'relation', relation }
            })
          }}
        />
      ),
      group: GroupNode,
    }),
    [theme, handleEditColumn, handleDeleteColumn, selectedTable]
  );

  // Setup keyboard shortcuts
  const shortcutHandlers = {
    save: handleExport,
    undo: undo,
    redo: redo,
    group: () => setIsGroupDialogOpen(true),
    search: () => document.querySelector('.search-input')?.focus(),
    // delete: handleDeleteColumn,
    delete: handleDeleteTable,
    deselect: () => setSelectedTable(null),
  };

  useKeyboardShortcuts(shortcutHandlers);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const schema = JSON.parse(text);
        handleSchemaImport(schema);
      } catch (error) {
        console.error('Error reading schema file:', error);
      }
    }
  };

  // Inside ERDBuilder.jsx
  return (
    <ErrorBoundary>
      <LoadingState loading={isLoading} message={loadingMessage}>
        <div className="flex flex-col h-screen">
          {/* Top Navigation */}
          <div className="bg-white border-b p-4 shadow-sm">
            <div className="flex justify-between items-center space-x-4">
              <h1 className="text-xl font-bold">NestJS Schema Generator</h1>
              <div className="flex items-center gap-4">
                {/* Left side buttons */}
                <div className="flex items-center gap-2 tools-section">
                  <Tutorial />
                  <ShortcutsGuide />
                  {/* <Button variant="secondary" size="sm" onClick={() => setIsTutorialOpen(true)}>
                    <Clock className="w-4 h-4 mr-2" /> Tutorial
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsShortcutsOpen(true)}>
                    <Keyboard className="w-4 h-4 mr-2" /> Shortcuts
                  </Button> */}
                </div>

                {/* Middle section */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleLayout('TB')}>
                    <Layout className="w-4 h-4 mr-2" /> Auto Layout
                  </Button>
                </div>

                {/* Right side buttons */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleAddGroup}>
                    <Folder className="w-4 h-4 mr-2" /> Add Group
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('schemaInput').click()}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Import Schema
                  </Button>
                  <input
                    id="schemaInput"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button variant="outline" size="sm" onClick={() => setIsConfigOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" /> Configure
                  </Button>
                  <Button className="export-section" variant="primary" size="sm" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" /> Export Schema
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
            <div className="w-64 bg-white border-r p-4">
              <div className="space-y-4">
                <div className="relative">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    type="text"
                    placeholder="Search tables..."
                    className="w-full border rounded-md py-2 px-3 pl-9 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>

                <TableDialog onAddTable={handleAddTable} />

                <div className="mt-4 space-y-1 table-list">
                  {nodes.map((node, index) => (
                    <div
                      key={node.id}
                      // className={`p-2 rounded cursor-pointer transition-colors ${selectedTable === node.id
                      //   ? 'bg-blue-50 text-blue-700 font-bold'
                      //   : 'text-gray-700 hover:bg-gray-50 bg-white'
                      //   }`}
                      className={`
          p-2 rounded cursor-pointer transition-colors text-gray-700
          ${selectedTable === node.id
                          ? 'bg-blue-100 text-blue-700 font-bold'
                          : index % 2 === 0
                            ? 'bg-green-100 hover:bg-gray-100'
                            : 'bg-slate-100 hover:bg-gray-50'
                        }
        `}
                      onClick={() => setSelectedTable(node.id)}
                    >
                      {index + 1 + ") "}
                      {node.data.name}
                    </div>
                  ))}

                </div>
              </div>
            </div>

            {/* Main ERD Area */}
            <div className="flex-1 bg-gray-50 erd-area">
              <ReactFlow
                nodes={filteredNodes}
                edges={filteredEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultViewport={{
                  zoom: 0.1,
                  x: 200,
                  y: 200
                }}
                edgesFocusable
                onNodeClick={handleNodeClick}
              >
                <Background color="#ddd" gap={16} />
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
                    onDelete={handleDeleteTable}
                  />
                  <div className="w-64 border-l p-4">
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
                                className="text-sm p-2 bg-gray-50 rounded mb-1 text-dark"
                              >
                                {column.name} ({column.type})
                                {column.nullable && <span>, nullable</span>}
                                {column.default && <span>, default: {column.default}</span>}
                                {column.unsigned && <span>, unsigned</span>}
                                {column.length && <span>, length: {column.length}</span>}
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
                                className="text-sm p-2 bg-gray-50 rounded mb-1 text-dark"
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
            title={deleteConfirm.data?.type.slice(0, 1).toUpperCase() + deleteConfirm.data?.type.slice(1) + ' Delete'}
            description={
              `Are you sure you want to delete this ${deleteConfirm.data?.type}? This action cannot be undone.`
            }
          />
          <RelationDialog
            isOpen={isRelationDialogOpen}
            onClose={() => setIsRelationDialogOpen(false)}
            tables={nodes}
            sourceTable={selectedTable}
            onAddRelation={handleAddRelation}
            currentRelation={editingRelation}
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