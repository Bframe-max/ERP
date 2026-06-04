import { useState, useEffect } from 'react';
import api from '../lib/api';

export function usePendientesInbox(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    api.get('/inbox').then((res) => {
      setCount(res.data?.meta?.total ?? 0);
    }).catch(() => setCount(0));
  }, []);

  return count;
}
