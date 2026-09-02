type ToastFn = (message: unknown, data?: unknown) => string | number;
type ToastLevel = 'error' | 'warning';

const { mockToast, mockErrorToast, mockWarningToast, mockReportToastError } = vi.hoisted(() => {
  const mockErrorToast = vi.fn<(message: unknown, data?: unknown) => string | number>(() => 'error-toast-id');
  const mockWarningToast = vi.fn<(message: unknown, data?: unknown) => string | number>(() => 'warning-toast-id');
  const mockReportToastError = vi.fn<(text: string, level: 'error' | 'warning') => void>();

  const mockToast: Record<string, ToastFn> = {
    error: mockErrorToast,
    warning: mockWarningToast,
  };

  return {
    mockToast,
    mockErrorToast,
    mockWarningToast,
    mockReportToastError,
  };
});

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('./frontendErrorCapture', () => ({
  frontendErrorCapture: {
    reportToastError: mockReportToastError,
  },
}));

async function importToastCapture() {
  vi.resetModules();
  return await import('./toastCapture');
}

describe('installToastCapture', () => {
  beforeEach(() => {
    mockErrorToast.mockReset();
    mockWarningToast.mockReset();
    mockReportToastError.mockReset();

    mockErrorToast.mockReturnValue('error-toast-id');
    mockWarningToast.mockReturnValue('warning-toast-id');

    mockToast.error = mockErrorToast;
    mockToast.warning = mockWarningToast;
  });

  it('wraps toast.error and forwards string errors with descriptions to frontend error capture', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    expect(mockToast.error).not.toBe(mockErrorToast);

    const result = mockToast.error('Save failed', { description: 'Network unavailable' });

    expect(result).toBe('error-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith(
      'Save failed — Network unavailable',
      'error',
    );
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith('Save failed', {
      description: 'Network unavailable',
    });
  });

  it('wraps toast.warning and forwards warning toasts with their severity', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    expect(mockToast.warning).not.toBe(mockWarningToast);

    const result = mockToast.warning('Quota almost reached', { description: 'Please clean files' });

    expect(result).toBe('warning-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith(
      'Quota almost reached — Please clean files',
      'warning',
    );
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockWarningToast).toHaveBeenCalledWith('Quota almost reached', {
      description: 'Please clean files',
    });
  });

  it('extracts message text from Error objects before reporting', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const error = new Error('Upload failed');
    const result = mockToast.error(error, { description: 'File too large' });

    expect(result).toBe('error-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith(
      'Upload failed — File too large',
      'error',
    );
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith(error, { description: 'File too large' });
  });

  it('uses an object toString fallback when no message property exists', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const message = {
      toString: () => 'Custom warning object',
    };

    const result = mockToast.warning(message);

    expect(result).toBe('warning-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith('Custom warning object', 'warning');
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockWarningToast).toHaveBeenCalledWith(message, undefined);
  });

  it('converts primitive messages and description values to readable text', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const result = mockToast.error(404, { description: 503 });

    expect(result).toBe('error-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith('404 — 503', 'error');
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith(404, { description: 503 });
  });

  it('does not report blank toast text but still calls the original toast function', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const result = mockToast.error('   ');

    expect(result).toBe('error-toast-id');
    expect(mockReportToastError).not.toHaveBeenCalled();
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith('   ', undefined);
  });

  it('does not report empty text from nullish messages without a description', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const result = mockToast.warning(null);

    expect(result).toBe('warning-toast-id');
    expect(mockReportToastError).not.toHaveBeenCalled();
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockWarningToast).toHaveBeenCalledWith(null, undefined);
  });

  it('does not install wrappers more than once', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();
    const firstErrorWrapper = mockToast.error;
    const firstWarningWrapper = mockToast.warning;

    installToastCapture();

    expect(mockToast.error).toBe(firstErrorWrapper);
    expect(mockToast.warning).toBe(firstWarningWrapper);

    mockToast.error('Only once');
    mockToast.warning('Still once');

    expect(mockReportToastError).toHaveBeenCalledTimes(2);
    expect(mockReportToastError).toHaveBeenCalledWith('Only once', 'error');
    expect(mockReportToastError).toHaveBeenCalledWith('Still once', 'warning');
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith('Only once', undefined);
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockWarningToast).toHaveBeenCalledWith('Still once', undefined);
  });

  it('never prevents the original warning toast when frontend capture throws', async () => {
    const { installToastCapture } = await importToastCapture();

    mockReportToastError.mockImplementationOnce(() => {
      throw new Error('Capture failed');
    });

    installToastCapture();

    const result = mockToast.warning('Connection unstable');

    expect(result).toBe('warning-toast-id');
    expect(mockReportToastError).toHaveBeenCalledTimes(1);
    expect(mockReportToastError).toHaveBeenCalledWith('Connection unstable', 'warning');
    expect(mockWarningToast).toHaveBeenCalledTimes(1);
    expect(mockWarningToast).toHaveBeenCalledWith('Connection unstable', undefined);
  });

  it('never prevents the original error toast when extracting text throws', async () => {
    const { installToastCapture } = await importToastCapture();

    installToastCapture();

    const message = {
      toString: () => {
        throw new Error('Cannot stringify');
      },
    };

    const result = mockToast.error(message);

    expect(result).toBe('error-toast-id');
    expect(mockReportToastError).not.toHaveBeenCalled();
    expect(mockErrorToast).toHaveBeenCalledTimes(1);
    expect(mockErrorToast).toHaveBeenCalledWith(message, undefined);
  });
});