import { useState, useCallback } from 'react';
import { IssueType } from './types';

interface DispatchAgentProps {
  vehicleId: string;
  onClose: () => void;
  onDispatch: (issueType: IssueType, notes: string) => void;
}

const DispatchAgent = ({ vehicleId, onClose, onDispatch }: DispatchAgentProps) => {
  const [issueType, setIssueType] = useState<IssueType>(IssueType.BATTERY_LOW);
  const [notes, setNotes] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onDispatch(issueType, notes);
    onClose();
  }, [issueType, notes, onDispatch, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Dispatch Field Agent (Immediate Action)</h3>
          <button onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vehicle ID:</label>
            <input type="text" value={vehicleId} disabled />
          </div>
          
          <div className="form-group">
            <label>Issue Type:</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}>
              <option value={IssueType.BATTERY_LOW}>Battery Low</option>
              <option value={IssueType.MECHANICAL}>Mechanical Issue</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Notes:</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Clear instructions for field agent (what to check, urgency, customer context)..."
              rows={4}
              required
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Send Agent</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DispatchAgent;
