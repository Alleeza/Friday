function compactDetails(details) {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function createDiagnosticError(message, details = {}, statusCode = 500, cause = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.diagnostic = compactDetails(details);
  if (cause) {
    error.cause = cause;
  }
  return error;
}

export function attachDiagnostic(error, details = {}, fallbackStatusCode = 500) {
  if (!error || typeof error !== 'object') {
    return createDiagnosticError('Unknown failure.', details, fallbackStatusCode);
  }

  error.statusCode = error.statusCode || fallbackStatusCode;
  error.diagnostic = compactDetails({
    ...(error.diagnostic || {}),
    ...details,
  });
  return error;
}

export function formatErrorPayload(error, fallbackMessage) {
  const payload = {
    error: error?.message || fallbackMessage,
  };

  if (error?.diagnostic && Object.keys(error.diagnostic).length > 0) {
    payload.diagnostic = error.diagnostic;
  }

  if (error?.cause?.message) {
    payload.cause = error.cause.message;
  }

  return payload;
}
