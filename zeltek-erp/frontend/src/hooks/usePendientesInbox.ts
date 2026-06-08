import { useState, useEffect } from 'react';
import api from '../lib/api';

export function usePendientesInbox(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    api.get<{ data: { estado: string }[] }>('/inbox')
      .then(res => {
        const pendientes = (res.data?.data ?? []).filter(i => i.estado === 'pendiente_triage').length;
        setCount(pendientes);
      })
      .catch(() => setCount(0));
  }, []);

  return count;
}
