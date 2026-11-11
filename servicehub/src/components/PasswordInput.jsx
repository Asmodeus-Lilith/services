import React, { useState } from 'react';

/** Shows the password only while the user holds the adjacent control. */
const PasswordInput = ({ className = '', ...inputProps }) => {
  const [revealed, setRevealed] = useState(false);

  const startReveal = (event) => {
    if (event.type === 'pointerdown') event.preventDefault();
    setRevealed(true);
  };

  const stopReveal = () => setRevealed(false);

  return (
    <div className="password-input-wrap">
      <input
        {...inputProps}
        className={className}
        type={revealed ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-reveal-btn"
        aria-label={revealed ? 'Password is visible' : 'Hold to show password'}
        aria-pressed={revealed}
        onPointerDown={startReveal}
        onPointerUp={stopReveal}
        onPointerLeave={stopReveal}
        onPointerCancel={stopReveal}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            setRevealed(true);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') stopReveal();
        }}
        onBlur={stopReveal}
      >
        {revealed ? 'Release to hide' : 'Hold to show'}
      </button>
    </div>
  );
};

export default PasswordInput;
