const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  tryCount = 1,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    // Wait before retrying (100ms delay)
    await sleep(100 * tryCount);
    return retry(fn, retries - 1, tryCount + 1);
  }
};
