// All keys share the quota-pool Redis hash tag, including cross-environment budgets.
export const COUNTERS_SCRIPT = `
local specs = cjson.decode(ARGV[1])
for i, spec in ipairs(specs) do
  local value = tonumber(redis.call('GET', KEYS[i]) or '0')
  if value + spec.amount > spec.limit then return {i, math.max(1, redis.call('PTTL', KEYS[i]))} end
end
for i, spec in ipairs(specs) do
  redis.call('INCRBY', KEYS[i], spec.amount)
  if redis.call('PTTL', KEYS[i]) < 0 then redis.call('PEXPIRE', KEYS[i], spec.ttl) end
end
return {0, 0}
`;
export const BEGIN_ANALYSIS_SCRIPT = `
local previous = redis.call('GET', KEYS[1])
if previous then
  local state = cjson.decode(previous)
  if state.hash ~= ARGV[1] then return {'IDEMPOTENCY_CONFLICT', 0} end
  return {state.status == 'running' and 'ANALYSIS_IN_PROGRESS' or 'ANALYSIS_ALREADY_PROCESSED', 0}
end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'ANALYSIS_IN_PROGRESS', 0} end
for i = 3, 4 do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then
    return {i == 3 and 'GUEST_ANALYSIS_LIMIT_REACHED' or 'NETWORK_LIMIT_REACHED', redis.call('PTTL', KEYS[i])}
  end
end
redis.call('SET', KEYS[1], cjson.encode({hash=ARGV[1],status='running',owner=ARGV[2]}), 'PX', ARGV[5])
redis.call('SET', KEYS[2], ARGV[2], 'PX', 60000)
for i = 3, 4 do
  redis.call('INCR', KEYS[i])
  if redis.call('PTTL', KEYS[i]) < 0 then redis.call('PEXPIRE', KEYS[i], i == 3 and 604800000 or 86400000) end
end
return {'OK', 0}
`;
export const FINISH_ANALYSIS_SCRIPT = `
if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
local previous = redis.call('GET', KEYS[1])
if previous then
  local state = cjson.decode(previous)
  if state.owner == ARGV[1] then
    state.status = ARGV[2]
    redis.call('SET', KEYS[1], cjson.encode(state), 'KEEPTTL')
  end
end
return 1
`;
export const RESERVE_AI_SCRIPT = `
local circuit = redis.call('PTTL', KEYS[1])
if circuit > 0 then return {-1, circuit} end
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 60000)
local used = 0
for _, item in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
  used = used + tonumber(string.match(item, ':(%d+)$'))
end
if used + tonumber(ARGV[3]) > 6000 then return {-2, 60000} end
local specs = cjson.decode(ARGV[4])
for i, spec in ipairs(specs) do
  local value = tonumber(redis.call('GET', KEYS[i+2]) or '0')
  if value + spec.amount > spec.limit then return {i, math.max(1, redis.call('PTTL', KEYS[i+2]))} end
end
redis.call('SET', KEYS[#specs+3], ARGV[5], 'PX', 2592000000)
redis.call('ZADD', KEYS[2], now, ARGV[2] .. ':' .. ARGV[3])
redis.call('PEXPIRE', KEYS[2], 60000)
for i, spec in ipairs(specs) do
  redis.call('INCRBY', KEYS[i+2], spec.amount)
  if redis.call('PTTL', KEYS[i+2]) < 0 then redis.call('PEXPIRE', KEYS[i+2], spec.ttl) end
end
local percent = 0
for i, spec in ipairs(specs) do
  if i <= 6 then percent = math.max(percent, tonumber(redis.call('GET', KEYS[i+2])) * 100 / spec.limit) end
end
return {0, 0, math.floor(percent)}
`;
export const SETTLE_AI_SCRIPT = `
local specs = cjson.decode(ARGV[1])
for i, spec in ipairs(specs) do
  if redis.call('EXISTS', KEYS[i+1]) == 1 then redis.call('INCRBY', KEYS[i+1], ARGV[2]) end
end
redis.call('SET', KEYS[1], ARGV[3], 'PX', 2592000000)
return 1
`;
export const SET_RECORD_SCRIPT = `redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]); return 1`;
export const ONCE_SCRIPT = `return redis.call('SET', KEYS[1], '1', 'PX', ARGV[1], 'NX') or ''`;
export const THROTTLE_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local block = redis.call('PTTL', KEYS[2])
if total > tonumber(ARGV[2]) and block < 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3]); block = tonumber(ARGV[3])
end
return {total, math.max(0, redis.call('PTTL', KEYS[1])), math.max(0, block)}
`;
