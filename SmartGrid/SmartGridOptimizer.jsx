import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as d3 from 'd3';

// Smart Grid Optimizer - React Application
// This application demonstrates how machine learning can be used to optimize electrical grid performance
// It includes:
// 1. Real-time grid simulation with power flow visualization
// 2. ML-based load prediction and optimization
// 3. Fault detection system
// 4. Energy efficiency metrics

export default function SmartGridOptimizer() {
  // State for grid simulation
  const [gridState, setGridState] = useState({
    nodes: generateNodes(12),
    connections: generateConnections(12),
    powerFlow: [],
    loadPrediction: [],
    efficiency: 0.82,
    faults: [],
    optimizationActive: false,
    simulationRunning: false,
    timeStep: 0,
    mlModel: 'transformerNN', // Neural network architecture used
    predictionAccuracy: 0.89,
  });
  
  const [simulationSpeed, setSimulationSpeed] = useState(1000); // ms between updates
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'analytics', 'prediction'
  const [selectedNode, setSelectedNode] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState([]);
  
  const svgRef = useRef();
  const simulationInterval = useRef(null);
  
  // Generate initial grid nodes
  function generateNodes(count) {
    const nodes = [];
    // Create a mix of generation, distribution, and consumption nodes
    for (let i = 0; i < count; i++) {
      const nodeType = i < 3 ? 'generation' : 
                      i < 7 ? 'distribution' : 'consumption';
                      
      const capacity = nodeType === 'generation' ? 100 + Math.random() * 400 :
                      nodeType === 'distribution' ? 50 + Math.random() * 200 :
                      20 + Math.random() * 80;
                      
      const currentLoad = Math.random() * capacity * 0.8;
      
      nodes.push({
        id: `node-${i}`,
        type: nodeType,
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
        capacity,
        currentLoad,
        efficiency: 0.7 + Math.random() * 0.25,
        status: Math.random() > 0.9 ? 'warning' : 'normal',
        history: Array(24).fill(0).map(() => currentLoad * (0.8 + Math.random() * 0.4)),
      });
    }
    return nodes;
  }
  
  // Generate connections between nodes
  function generateConnections(nodeCount) {
    const connections = [];
    // Create a connected network with some redundancy
    for (let i = 0; i < nodeCount; i++) {
      // Each node connects to 2-4 other nodes
      const connectionCount = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < connectionCount; j++) {
        let target = Math.floor(Math.random() * nodeCount);
        // Avoid self-connections and duplicates
        while (target === i || connections.some(c => 
          (c.source === `node-${i}` && c.target === `node-${target}`) || 
          (c.source === `node-${target}` && c.target === `node-${i}`))) {
          target = Math.floor(Math.random() * nodeCount);
        }
        
        connections.push({
          id: `conn-${i}-${target}`,
          source: `node-${i}`,
          target: `node-${target}`,
          capacity: 100 + Math.random() * 200,
          load: Math.random() * 80,
          status: Math.random() > 0.95 ? 'critical' : Math.random() > 0.8 ? 'warning' : 'normal',
        });
      }
    }
    return connections;
  }
  
  // Generate historical and predicted power data
  function generatePowerData() {
    const now = new Date();
    const data = [];
    
    // Generate 24 hours of past data and 12 hours of predictions
    for (let i = -24; i < 12; i++) {
      const time = new Date(now);
      time.setHours(time.getHours() + i);
      
      // Create a realistic power consumption curve with morning and evening peaks
      const hour = time.getHours();
      let baseDemand = 400 + Math.random() * 50;
      
      // Morning peak
      if (hour >= 6 && hour <= 9) {
        baseDemand += 200 + Math.random() * 100;
      }
      // Evening peak
      else if (hour >= 18 && hour <= 22) {
        baseDemand += 300 + Math.random() * 150;
      }
      // Night valley
      else if (hour >= 0 && hour <= 5) {
        baseDemand -= 200 + Math.random() * 50;
      }
      
      const predicted = i >= 0;
      const optimized = i >= 0 && gridState.optimizationActive;
      
      // Add noise to the prediction and greater error for further predictions
      const predictionError = predicted ? (Math.random() - 0.5) * 50 * (1 + i/10) : 0;
      
      // Optimization reduces consumption by 5-15%
      const optimizationFactor = optimized ? 0.85 - (Math.random() * 0.1) : 1;
      
      data.push({
        time: time.toLocaleTimeString(),
        fullTime: time.toLocaleString(),
        actual: predicted ? null : baseDemand,
        predicted: predicted ? baseDemand + predictionError : null,
        optimized: optimized ? (baseDemand + predictionError) * optimizationFactor : null,
        isPredicton: predicted,
      });
    }
    
    return data;
  }
  
  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current || viewMode !== 'grid') return;
    
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    
    // Clear previous visualization
    svg.selectAll("*").remove();
    
    // Create simulation
    const simulation = d3.forceSimulation(gridState.nodes)
      .force("link", d3.forceLink(gridState.connections)
        .id(d => d.id)
        .distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);
    
    // Draw connections
    const link = svg.append("g")
      .selectAll("line")
      .data(gridState.connections)
      .enter()
      .append("line")
      .attr("stroke-width", d => Math.sqrt(d.load / 10))
      .attr("stroke", d => d.status === 'critical' ? "#ff0000" : 
                          d.status === 'warning' ? "#ffa500" : "#999")
      .attr("stroke-opacity", 0.8);
    
    // Draw nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(gridState.nodes)
      .enter()
      .append("circle")
      .attr("r", d => Math.sqrt(d.currentLoad) / 2 + 5)
      .attr("fill", d => {
        if (d.type === 'generation') return "#4CAF50";
        if (d.type === 'distribution') return "#2196F3";
        return "#9C27B0";
      })
      .attr("stroke", d => d.status === 'warning' ? "#ffa500" : 
                          d.status === 'critical' ? "#ff0000" : "#fff")
      .attr("stroke-width", 2)
      .call(drag(simulation));
    
    // Add labels
    const label = svg.append("g")
      .selectAll("text")
      .data(gridState.nodes)
      .enter()
      .append("text")
      .text(d => d.id)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
      .style("pointer-events", "none");
    
    // Update positions on simulation tick
    function ticked() {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
        
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
        
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    }
    
    // Add drag behavior
    function drag(simulation) {
      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
    
    // Handle node selection
    node.on("click", (event, d) => {
      setSelectedNode(d);
    });
    
    return () => {
      simulation.stop();
    };
  }, [gridState.nodes, gridState.connections, viewMode]);
  
  // Run ML optimization algorithm
  function runOptimization() {
    // Simulate ML optimization by adjusting loads
    const optimizedNodes = gridState.nodes.map(node => {
      const loadReduction = Math.random() * 0.15; // 0-15% reduction
      const newLoad = node.currentLoad * (1 - loadReduction);
      
      return {
        ...node,
        currentLoad: newLoad,
        optimized: true,
      };
    });
    
    // Calculate new power flows
    const optimizedConnections = gridState.connections.map(conn => {
      const loadReduction = Math.random() * 0.2; // 0-20% reduction
      return {
        ...conn,
        load: conn.load * (1 - loadReduction),
      };
    });
    
    // Calculate efficiency improvement
    const newEfficiency = gridState.efficiency + (Math.random() * 0.08); // 0-8% improvement
    
    // Update optimization results
    const results = [
      ...optimizationResults,
      {
        timestamp: new Date().toLocaleTimeString(),
        efficiency: newEfficiency.toFixed(2),
        loadReduction: (Math.random() * 12 + 3).toFixed(1) + '%', // 3-15%
        costSavings: '$' + (Math.random() * 1200 + 300).toFixed(2), // $300-$1500
        co2Reduction: (Math.random() * 2 + 0.5).toFixed(1) + ' tons', // 0.5-2.5 tons
      }
    ];
    
    setOptimizationResults(results);
    
    setGridState({
      ...gridState,
      nodes: optimizedNodes,
      connections: optimizedConnections,
      efficiency: newEfficiency,
      optimizationActive: true,
      loadPrediction: generatePowerData(),
    });
  }
  
  // Update simulation
  const updateSimulation = () => {
    if (!gridState.simulationRunning) return;
    
    const newNodes = gridState.nodes.map(node => {
      // Adjust load based on time of day and randomness
      let loadChange = (Math.random() - 0.5) * 10;
      const hour = new Date().getHours();
      
      // Increase load during peak hours
      if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 21)) {
        loadChange += 5;
      }
      
      let newLoad = node.currentLoad + loadChange;
      // Ensure load stays within reasonable bounds
      newLoad = Math.max(node.capacity * 0.1, Math.min(node.capacity * 0.95, newLoad));
      
      // Randomly introduce faults
      const newStatus = Math.random() > 0.98 ? 'warning' : 
                        Math.random() > 0.995 ? 'critical' : node.status;
                        
      return {
        ...node,
        currentLoad: newLoad,
        status: newStatus,
        history: [...node.history.slice(1), newLoad],
      };
    });
    
    // Update connections
    const newConnections = gridState.connections.map(conn => {
      // Find connected nodes
      const sourceNode = newNodes.find(n => n.id === conn.source);
      const targetNode = newNodes.find(n => n.id === conn.target);
      
      // Calculate new load based on connected nodes
      if (sourceNode && targetNode) {
        let newLoad = (sourceNode.currentLoad + targetNode.currentLoad) / 4 * (0.8 + Math.random() * 0.4);
        newLoad = Math.min(conn.capacity * 0.95, newLoad);
        
        // Connection status depends on load relative to capacity
        const loadRatio = newLoad / conn.capacity;
        const newStatus = loadRatio > 0.9 ? 'critical' : 
                          loadRatio > 0.7 ? 'warning' : 'normal';
                          
        return {
          ...conn,
          load: newLoad,
          status: newStatus,
        };
      }
      return conn;
    });
    
    // Detect faults
    const faults = [...gridState.faults];
    // Simulate fault detection
    if (Math.random() > 0.9) {
      const nodeWithIssue = newNodes.find(n => n.status !== 'normal');
      const connWithIssue = newConnections.find(c => c.status !== 'normal');
      
      if (nodeWithIssue || connWithIssue) {
        const component = nodeWithIssue || connWithIssue;
        const faultType = Math.random() > 0.7 ? 'Overload' : 
                          Math.random() > 0.5 ? 'Voltage sag' : 
                          Math.random() > 0.3 ? 'Phase imbalance' : 'Connection loss';
                          
        const newFault = {
          id: `fault-${Date.now()}`,
          component: component.id,
          type: faultType,
          severity: component.status === 'critical' ? 'High' : 'Medium',
          timestamp: new Date().toLocaleTimeString(),
          resolved: false,
        };
        
        // Keep only the last 5 faults
        if (faults.length >= 5) {
          faults.shift();
        }
        faults.push(newFault);
      }
    }
    
    // Randomly resolve some faults
    const updatedFaults = faults.map(fault => {
      if (!fault.resolved && Math.random() > 0.7) {
        return { ...fault, resolved: true };
      }
      return fault;
    });
    
    setGridState({
      ...gridState,
      nodes: newNodes,
      connections: newConnections,
      faults: updatedFaults,
      timeStep: gridState.timeStep + 1,
      // Update power flow and prediction data periodically
      powerFlow: gridState.timeStep % 5 === 0 ? generatePowerData() : gridState.powerFlow,
    });
  };
  
  // Start/stop simulation
  useEffect(() => {
    if (gridState.simulationRunning) {
      simulationInterval.current = setInterval(updateSimulation, simulationSpeed);
    } else if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
    }
    
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, [gridState.simulationRunning, simulationSpeed]);
  
  // Initialize power data on first load
  useEffect(() => {
    setGridState(prev => ({
      ...prev,
      powerFlow: generatePowerData(),
      loadPrediction: generatePowerData(),
    }));
  }, []);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-900 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Smart Grid Optimizer</h1>
          <div className="flex space-x-4">
            <div className="flex items-center">
              <span className="mr-2">System Efficiency:</span>
              <span className={`font-bold ${
                gridState.efficiency > 0.9 ? 'text-green-400' : 
                gridState.efficiency > 0.8 ? 'text-green-300' : 
                'text-yellow-300'
              }`}>
                {(gridState.efficiency * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">Active Faults:</span>
              <span className={`font-bold ${
                gridState.faults.filter(f => !f.resolved).length > 0 ? 'text-red-300' : 'text-green-300'
              }`}>
                {gridState.faults.filter(f => !f.resolved).length}
              </span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">ML Model:</span>
              <span className="font-bold text-green-300">
                {gridState.mlModel}
              </span>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex space-x-4 bg-gray-800 text-white px-4 py-2">
        <button 
          className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setViewMode('grid')}
        >
          Grid View
        </button>
        <button 
          className={`px-3 py-1 rounded ${viewMode === 'analytics' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setViewMode('analytics')}
        >
          Analytics
        </button>
        <button 
          className={`px-3 py-1 rounded ${viewMode === 'prediction' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => setViewMode('prediction')}
        >
          ML Prediction
        </button>
        <div className="flex-grow"></div>
        <button 
          className={`px-3 py-1 rounded ${gridState.simulationRunning ? 'bg-red-600' : 'bg-green-600'}`}
          onClick={() => setGridState({...gridState, simulationRunning: !gridState.simulationRunning})}
        >
          {gridState.simulationRunning ? 'Stop Simulation' : 'Start Simulation'}
        </button>
        <button 
          className={`px-3 py-1 rounded ${gridState.optimizationActive ? 'bg-purple-600' : 'bg-blue-600'}`}
          onClick={runOptimization}
          disabled={gridState.optimizationActive}
        >
          {gridState.optimizationActive ? 'Optimization Active' : 'Run ML Optimization'}
        </button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 p-4 overflow-auto">
          {viewMode === 'grid' && (
            <div className="bg-white rounded-lg shadow-lg p-4 h-full">
              <h2 className="text-lg font-semibold mb-2">Grid Simulation</h2>
              <svg 
                ref={svgRef} 
                width="100%" 
                height="600px" 
                className="border border-gray-300 rounded bg-gray-50"
              ></svg>
              <div className="mt-4 flex space-x-4">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                  <span>Generation</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                  <span>Distribution</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                  <span>Consumption</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-red-500 rounded-full mr-2"></div>
                  <span>Critical Status</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-orange-500 rounded-full mr-2"></div>
                  <span>Warning Status</span>
                </div>
              </div>
            </div>
          )}
          
          {viewMode === 'analytics' && (
            <div className="bg-white rounded-lg shadow-lg p-4 h-full overflow-auto">
              <h2 className="text-lg font-semibold mb-2">Power Flow Analytics</h2>
              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gridState.powerFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-800 text-white p-2 rounded shadow-lg">
                            <p className="text-sm">{payload[0]?.payload.fullTime}</p>
                            {payload[0]?.payload.actual !== null && (
                              <p className="text-sm text-green-300">Actual: {payload[0].payload.actual.toFixed(0)} kW</p>
                            )}
                            {payload[0]?.payload.predicted !== null && (
                              <p className="text-sm text-blue-300">Predicted: {payload[0].payload.predicted.toFixed(0)} kW</p>
                            )}
                            {payload[0]?.payload.optimized !== null && (
                              <p className="text-sm text-purple-300">Optimized: {payload[0].payload.optimized.toFixed(0)} kW</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#4CAF50" 
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                      name="Actual Load"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#2196F3" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      name="Predicted Load"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="optimized" 
                      stroke="#9C27B0" 
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      name="Optimized Load"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <h3 className="text-lg font-semibold mt-6 mb-2">Fault Detection Log</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-left">Time</th>
                      <th className="py-2 px-4 text-left">Component</th>
                      <th className="py-2 px-4 text-left">Type</th>
                      <th className="py-2 px-4 text-left">Severity</th>
                      <th className="py-2 px-4 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridState.faults.map((fault, index) => (
                      <tr key={fault.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-4">{fault.timestamp}</td>
                        <td className="py-2 px-4">{fault.component}</td>
                        <td className="py-2 px-4">{fault.type}</td>
                        <td className={`py-2 px-4 ${
                          fault.severity === 'High' ? 'text-red-500' : 
                          fault.severity === 'Medium' ? 'text-orange-500' : 'text-yellow-500'
                        }`}>
                          {fault.severity}
                        </td>
                        <td className={`py-2 px-4 ${fault.resolved ? 'text-green-500' : 'text-red-500'}`}>
                          {fault.resolved ? 'Resolved' : 'Active'}
                        </td>
                      </tr>
                    ))}
                    {gridState.faults.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-4 text-center text-gray-500">No faults detected</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {viewMode === 'prediction' && (
            <div className="bg-white rounded-lg shadow-lg p-4 h-full overflow-auto">
              <h2 className="text-lg font-semibold mb-2">ML-Based Load Prediction & Optimization</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-blue-800 font-semibold">ML Model</h3>
                  <p className="text-2xl font-bold">{gridState.mlModel}</p>
                  <p className="text-sm text-gray-600">Transformer Neural Network with Attention</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-green-800 font-semibold">Prediction Accuracy</h3>
                  <p className="text-2xl font-bold">{(gridState.predictionAccuracy * 100).toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">MAPE: {(10 - gridState.predictionAccuracy * 10).toFixed(2)}%</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="text-purple-800 font-semibold">Optimization Status</h3>
                  <p className="text-2xl font-bold">{gridState.optimizationActive ? 'Active' : 'Inactive'}</p>
                  <p className="text-sm text-gray-600">{gridState.optimizationActive ? 'Optimizing grid operations' : 'Click Run ML Optimization to start'}</p>
                </div>
              </div>
              
              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gridState.loadPrediction}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#4CAF50" 
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                      name="Historical Load"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#2196F3" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      name="Predicted Load"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="optimized" 
                      stroke="#9C27B0" 
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      name="Optimized Load"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <h3 className="text-lg font-semibold mt-6 mb-2">ML Optimization Results</h3>
              {optimizationResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-2 px-4 text-left">Time</th>
                        <th className="py-2 px-4 text-left">Efficiency</th>
                        <th className="py-2 px-4 text-left">Load Reduction</th>
                        <th className="py-2 px-4 text-left">Cost Savings</th>
                        <th className="py-2 px-4 text-left">CO2 Reduction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimizationResults.map((result, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-2 px-4">{result.timestamp}</td>
                          <td className="py-2 px-4">{result.efficiency}</td>
                          <td className="py-2 px-4">{result.loadReduction}</td>
                          <td className="py-2 px-4">{result.costSavings}</td>
                          <td className="py-2 px-4">{result.co2Reduction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                  <p>No optimization has been run yet. Click "Run ML Optimization" to see results.</p>
                </div>
              )}
              
              <h3 className="text-lg font-semibold mt-6 mb-2">ML Techniques Used</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold">Load Forecasting</h4>
                  <p className="text-sm">Transformer-based neural network with attention mechanism for time-series forecasting. Uses historical consumption patterns, weather data, and seasonal variables.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold">Fault Detection</h4>
                  <p className="text-sm">Anomaly detection using isolation forests and autoencoders to identify abnormal grid behavior before cascading failures occur.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold">Load Balancing</h4>
                  <p className="text-sm">Reinforcement learning for dynamic load balancing across the grid, optimizing for efficiency and stability under varying conditions.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold">Preventative Maintenance</h4>
                  <p className="text-sm">Predictive maintenance scheduling using gradient boosting models to identify components likely to fail based on operational patterns.</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 text-white p-4 overflow-auto">
          <h2 className="text-lg font-semibold mb-4">Grid Status</h2>
          
          {selectedNode ? (
            <div className="mb-6">
              <h3 className="font-semibold border-b border-gray-600 pb-1 mb-2">Selected Node: {selectedNode.id}</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400">Type:</span>
                  <span className="ml-2 capitalize">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-gray-400">Load:</span>
                  <span className="ml-2">{selectedNode.currentLoad.toFixed(1)} kW</span>
                </div>
                <div>
                  <span className="text-gray-400">Capacity:</span>
                  <span className="ml-2">{selectedNode.capacity.toFixed(1)} kW</span>
                </div>
                <div>
                  <span className="text-gray-400">Efficiency:</span>
                  <span className="ml-2">{(selectedNode.efficiency * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className={`ml-2 capitalize ${
                    selectedNode.status === 'critical' ? 'text-red-400' : 
                    selectedNode.status === 'warning' ? 'text-yellow-400' : 
                    'text-green-400'
                  }`}>
                    {selectedNode.status}
                  </span>
                </div>
                <button 
                  className="mt-2 bg-blue-600 text-white px-2 py-1 rounded text-sm"
                  onClick={() => setSelectedNode(null)}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 text-gray-400 text-sm">
              Click on a node in the grid view to see detailed information
            </div>
          )}
          
          <h3 className="font-semibold border-b border-gray-600 pb-1 mb-2">Critical Components</h3>
          <div className="space-y-2 mb-6">
            {
              gridState.nodes.filter(n => n.status === 'critical' || n.status === 'warning').length === 0 && 
              gridState.connections.filter(c => c.status === 'critical' || c.status === 'warning').length === 0 ? (
                <div className="text-gray-400 text-sm">No critical components</div>
              ) : (
                <>
                  {gridState.nodes
                    .filter(n => n.status === 'critical' || n.status === 'warning')
                    .map(node => (
                      <div key={node.id} className="bg-gray-700 p-2 rounded">
                        <div className="flex justify-between">
                          <span>{node.id}</span>
                          <span className={node.status === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                            {node.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          Load: {node.currentLoad.toFixed(1)} / {node.capacity.toFixed(1)} kW
                        </div>
                      </div>
                    ))
                  }
                  {gridState.connections
                    .filter(c => c.status === 'critical' || c.status === 'warning')
                    .map(conn => (
                      <div key={conn.id} className="bg-gray-700 p-2 rounded">
                        <div className="flex justify-between">
                          <span>{conn.source} → {conn.target}</span>
                          <span className={conn.status === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                            {conn.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          Load: {conn.load.toFixed(1)} / {conn.capacity.toFixed(1)} kW
                        </div>
                      </div>
                    ))
                  }
                </>
              )
            }
          </div>
          
          <h3 className="font-semibold border-b border-gray-600 pb-1 mb-2">Simulation Controls</h3>
          <div className="space-y-3 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Simulation Speed</label>
              <select 
                className="w-full bg-gray-700 text-white px-2 py-1 rounded"
                value={simulationSpeed}
                onChange={(e) => setSimulationSpeed(parseInt(e.target.value))}
              >
                <option value="2000">Slow (2s)</option>
                <option value="1000">Normal (1s)</option>
                <option value="500">Fast (0.5s)</option>
                <option value="250">Very Fast (0.25s)</option>
              </select>
            </div>
            
            <button 
              className={`w-full py-2 rounded font-semibold ${
                gridState.simulationRunning ? 'bg-red-600' : 'bg-green-600'
              }`}
              onClick={() => setGridState({...gridState, simulationRunning: !gridState.simulationRunning})}
            >
              {gridState.simulationRunning ? 'Pause Simulation' : 'Resume Simulation'}
            </button>
            
            <button 
              className="w-full bg-blue-600 py-2 rounded font-semibold"
              onClick={() => {
                setGridState({
                  ...gridState,
                  nodes: generateNodes(12),
                  connections: generateConnections(12),
                  faults: [],
                  optimizationActive: false,
                  efficiency: 0.82,
                });
                setOptimizationResults([]);
              }}
            >
              Reset Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}