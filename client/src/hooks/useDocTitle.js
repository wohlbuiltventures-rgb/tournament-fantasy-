import { useEffect } from 'react';

export function useDocTitle(title) {
  useEffect(() => {
    document.title = title;
    return () => { document.title = 'TourneyRun'; };
  }, [title]);
}
