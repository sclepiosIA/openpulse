/**
 * JARVIS 10.0 - Circuit Breaker Pattern
 * 
 * Protège contre les cascades d'échecs avec 3 états:
 * - CLOSED: Fonctionnement normal
 * - OPEN: Fast-fail après trop d'échecs
 * - HALF-OPEN: Test avec requête limitée après cooldown
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitConfig {
  failureThreshold: number;      // Échecs consécutifs pour OPEN (default: 5)
  failureRateThreshold: number;  // Taux d'échec pour OPEN (default: 0.5 = 50%)
  windowSize: number;            // Nombre de requêtes pour calculer le taux (default: 20)
  cooldownMs: number;            // Temps avant HALF-OPEN (default: 30000)
  successThreshold: number;      // Succès consécutifs pour CLOSED (default: 2)
  name: string;                  // Identifiant du circuit
}

export interface CircuitMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  avgLatencyMs: number;
  p95LatencyMs: number;
  stateChangedAt: number;
}

interface CircuitEntry {
  state: CircuitState;
  config: CircuitConfig;
  metrics: CircuitMetrics;
  recentLatencies: number[];
}

// In-memory circuit states (per instance)
const circuits = new Map<string, CircuitEntry>();

// Default configurations by circuit type
const DEFAULT_CONFIGS: Record<string, Partial<CircuitConfig>> = {
  'azure-gpt52': {
    failureThreshold: 3,
    cooldownMs: 20000,
    failureRateThreshold: 0.4,
  },
  'azure-gpt5': {
    failureThreshold: 5,
    cooldownMs: 30000,
    failureRateThreshold: 0.5,
  },
  'tool': {
    failureThreshold: 5,
    cooldownMs: 15000,
    failureRateThreshold: 0.6,
  },
  'external-api': {
    failureThreshold: 3,
    cooldownMs: 45000,
    failureRateThreshold: 0.3,
  },
};

/**
 * Get or create a circuit breaker for a named resource
 */
export function getCircuit(name: string, customConfig?: Partial<CircuitConfig>): CircuitEntry {
  if (circuits.has(name)) {
    return circuits.get(name)!;
  }

  // Determine default config based on circuit type
  const circuitType = name.startsWith('azure-') ? name : 
                      name.startsWith('tool-') ? 'tool' : 
                      'external-api';
  const defaultForType = DEFAULT_CONFIGS[circuitType] || {};

  const config: CircuitConfig = {
    failureThreshold: 5,
    failureRateThreshold: 0.5,
    windowSize: 20,
    cooldownMs: 30000,
    successThreshold: 2,
    name,
    ...defaultForType,
    ...customConfig,
  };

  const entry: CircuitEntry = {
    state: 'CLOSED',
    config,
    metrics: {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      stateChangedAt: Date.now(),
    },
    recentLatencies: [],
  };

  circuits.set(name, entry);
  return entry;
}

/**
 * Check if a circuit allows requests
 */
export function canExecute(name: string): { allowed: boolean; state: CircuitState; reason?: string } {
  const circuit = getCircuit(name);
  const now = Date.now();

  switch (circuit.state) {
    case 'CLOSED':
      return { allowed: true, state: 'CLOSED' };

    case 'OPEN':
      // Check if cooldown has passed
      const timeSinceOpen = now - circuit.metrics.stateChangedAt;
      if (timeSinceOpen >= circuit.config.cooldownMs) {
        // Transition to HALF-OPEN
        transitionState(circuit, 'HALF-OPEN');
        console.log(`[CircuitBreaker] ${name}: OPEN -> HALF-OPEN after ${timeSinceOpen}ms cooldown`);
        return { allowed: true, state: 'HALF-OPEN' };
      }
      return { 
        allowed: false, 
        state: 'OPEN', 
        reason: `Circuit OPEN, retry in ${Math.ceil((circuit.config.cooldownMs - timeSinceOpen) / 1000)}s` 
      };

    case 'HALF-OPEN':
      // Allow limited requests in HALF-OPEN
      return { allowed: true, state: 'HALF-OPEN' };

    default:
      return { allowed: true, state: 'CLOSED' };
  }
}

/**
 * Record a successful execution
 */
export function recordSuccess(name: string, latencyMs: number): void {
  const circuit = getCircuit(name);
  const metrics = circuit.metrics;

  metrics.totalRequests++;
  metrics.successCount++;
  metrics.consecutiveFailures = 0;
  metrics.consecutiveSuccesses++;
  metrics.lastSuccessTime = Date.now();

  // Update latencies
  updateLatencies(circuit, latencyMs);

  // State transitions on success
  if (circuit.state === 'HALF-OPEN') {
    if (metrics.consecutiveSuccesses >= circuit.config.successThreshold) {
      transitionState(circuit, 'CLOSED');
      console.log(`[CircuitBreaker] ${name}: HALF-OPEN -> CLOSED after ${metrics.consecutiveSuccesses} successes`);
    }
  }
}

/**
 * Record a failed execution
 */
export function recordFailure(name: string, latencyMs: number, error?: string): void {
  const circuit = getCircuit(name);
  const metrics = circuit.metrics;

  metrics.totalRequests++;
  metrics.failureCount++;
  metrics.consecutiveFailures++;
  metrics.consecutiveSuccesses = 0;
  metrics.lastFailureTime = Date.now();

  // Update latencies
  updateLatencies(circuit, latencyMs);

  console.log(`[CircuitBreaker] ${name}: failure #${metrics.consecutiveFailures} (${error || 'unknown'})`);

  // State transitions on failure
  switch (circuit.state) {
    case 'CLOSED':
      // Check if we should open the circuit
      if (shouldOpenCircuit(circuit)) {
        transitionState(circuit, 'OPEN');
        console.log(`[CircuitBreaker] ${name}: CLOSED -> OPEN (${metrics.consecutiveFailures} consecutive failures)`);
      }
      break;

    case 'HALF-OPEN':
      // Any failure in HALF-OPEN goes back to OPEN
      transitionState(circuit, 'OPEN');
      console.log(`[CircuitBreaker] ${name}: HALF-OPEN -> OPEN (test failed)`);
      break;
  }
}

/**
 * Check if circuit should transition to OPEN
 */
function shouldOpenCircuit(circuit: CircuitEntry): boolean {
  const { config, metrics } = circuit;

  // Check consecutive failures
  if (metrics.consecutiveFailures >= config.failureThreshold) {
    return true;
  }

  // Check failure rate (only if we have enough samples)
  if (metrics.totalRequests >= config.windowSize) {
    const recentFailureRate = metrics.failureCount / metrics.totalRequests;
    if (recentFailureRate >= config.failureRateThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * Transition circuit to new state
 */
function transitionState(circuit: CircuitEntry, newState: CircuitState): void {
  const oldState = circuit.state;
  circuit.state = newState;
  circuit.metrics.stateChangedAt = Date.now();

  // Reset counters on state change
  if (newState === 'CLOSED') {
    // Reset failure tracking for fresh start
    circuit.metrics.consecutiveFailures = 0;
    circuit.metrics.failureCount = 0;
    circuit.metrics.totalRequests = 0;
  } else if (newState === 'HALF-OPEN') {
    circuit.metrics.consecutiveSuccesses = 0;
  }

  console.log(`[CircuitBreaker] ${circuit.config.name}: ${oldState} -> ${newState}`);
}

/**
 * Update latency tracking
 */
function updateLatencies(circuit: CircuitEntry, latencyMs: number): void {
  const latencies = circuit.recentLatencies;
  latencies.push(latencyMs);

  // Keep only last 100 latencies
  if (latencies.length > 100) {
    latencies.shift();
  }

  // Calculate metrics
  const sorted = [...latencies].sort((a, b) => a - b);
  circuit.metrics.avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  circuit.metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || 0;
}

/**
 * Get all circuit states (for monitoring)
 */
export function getAllCircuitStates(): Record<string, { state: CircuitState; metrics: CircuitMetrics }> {
  const states: Record<string, { state: CircuitState; metrics: CircuitMetrics }> = {};
  
  circuits.forEach((entry, name) => {
    states[name] = {
      state: entry.state,
      metrics: { ...entry.metrics },
    };
  });

  return states;
}

/**
 * Force reset a circuit (for manual recovery)
 */
export function resetCircuit(name: string): void {
  const circuit = circuits.get(name);
  if (circuit) {
    transitionState(circuit, 'CLOSED');
    circuit.metrics.totalRequests = 0;
    circuit.metrics.successCount = 0;
    circuit.metrics.failureCount = 0;
    circuit.metrics.consecutiveFailures = 0;
    circuit.metrics.consecutiveSuccesses = 0;
    circuit.recentLatencies = [];
    console.log(`[CircuitBreaker] ${name}: manually reset to CLOSED`);
  }
}

/**
 * Get health status based on all circuits
 */
export function getOverallHealth(): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE' {
  const states = getAllCircuitStates();
  const circuitNames = Object.keys(states);
  
  if (circuitNames.length === 0) {
    return 'HEALTHY';
  }

  const openCircuits = circuitNames.filter(name => states[name].state === 'OPEN');
  const halfOpenCircuits = circuitNames.filter(name => states[name].state === 'HALF-OPEN');
  
  // Critical circuits (Azure)
  const azureOpen = openCircuits.some(name => name.startsWith('azure-'));
  const bothAzureOpen = openCircuits.includes('azure-gpt52') && openCircuits.includes('azure-gpt5');

  if (bothAzureOpen) {
    return 'OFFLINE';
  }
  
  if (azureOpen || openCircuits.length >= 3) {
    return 'UNHEALTHY';
  }
  
  if (halfOpenCircuits.length > 0 || openCircuits.length > 0) {
    return 'DEGRADED';
  }

  // Check latency degradation
  const highLatencyCircuits = circuitNames.filter(name => 
    states[name].metrics.avgLatencyMs > 3000
  );
  
  if (highLatencyCircuits.length >= 2) {
    return 'DEGRADED';
  }

  return 'HEALTHY';
}

/**
 * Execute with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  circuitName: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitConfig>
): Promise<{ success: true; data: T } | { success: false; error: string; circuitOpen: boolean }> {
  // Initialize circuit if needed
  getCircuit(circuitName, config);

  // Check if circuit allows execution
  const check = canExecute(circuitName);
  if (!check.allowed) {
    return {
      success: false,
      error: check.reason || 'Circuit breaker is OPEN',
      circuitOpen: true,
    };
  }

  const startTime = Date.now();

  try {
    const result = await fn();
    const latency = Date.now() - startTime;
    recordSuccess(circuitName, latency);
    return { success: true, data: result };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    recordFailure(circuitName, latency, errorMessage);
    return {
      success: false,
      error: errorMessage,
      circuitOpen: false,
    };
  }
}
