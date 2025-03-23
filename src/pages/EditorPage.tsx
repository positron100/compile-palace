
import React from 'react';
import { useParams } from 'react-router-dom';

const EditorPage = () => {
  const { roomId } = useParams();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Editor Page</h1>
        <p className="text-gray-600">Room ID: {roomId}</p>
        <p className="mt-4">We'll implement the full editor functionality soon!</p>
      </div>
    </div>
  );
};

export default EditorPage;
