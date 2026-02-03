
import React from 'react';
import { useDataset } from '../src/context/DatasetContext';
import SpreadsheetView from './SpreadsheetView';
import { useNavigate } from 'react-router-dom';

const SpreadsheetViewIntegrated: React.FC = () => {
    const { activeDataset, updateDataset } = useDataset();
    const navigate = useNavigate();

    if (!activeDataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <p className="text-slate-500 font-medium">No dataset selected</p>
                <button
                    onClick={() => navigate('/datasets')}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                    Go to Library
                </button>
            </div>
        );
    }

    return (
        <SpreadsheetView
            dataset={activeDataset}
            onUpdate={updateDataset}
        />
    );
};

export default SpreadsheetViewIntegrated;
