import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

interface StudioLegacyRedirectProps {
  panel: string;
}

const StudioLegacyRedirect: React.FC<StudioLegacyRedirectProps> = ({ panel }) => {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  const validPanels = new Set(['sheets', 'query', 'pivot', 'visuals', 'report', 'actions', 'comms']);
  nextParams.set('panel', validPanels.has(panel) ? panel : 'sheets');
  return <Navigate to={`/app/studio?${nextParams.toString()}`} replace />;
};

export default StudioLegacyRedirect;
