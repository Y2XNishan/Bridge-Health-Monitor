export function filterAuditLogs(logs, status) {
  return status === 'ALL' ? logs : logs.filter((log) => log.status === status);
}
