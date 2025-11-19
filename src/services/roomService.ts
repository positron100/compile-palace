import { supabase } from '@/integrations/supabase/client';

export const saveRoomToDatabase = async (
  roomId: string,
  code: string,
  language: string
) => {
  try {
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_id', roomId)
      .maybeSingle();

    if (existingRoom) {
      // Update existing room
      const { error } = await supabase
        .from('rooms')
        .update({ code, language })
        .eq('room_id', roomId);

      if (error) throw error;
    } else {
      // Create new room
      const { error } = await supabase
        .from('rooms')
        .insert({ room_id: roomId, code, language });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error saving room to database:', error);
  }
};

export const loadRoomFromDatabase = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading room from database:', error);
    return null;
  }
};

export const addParticipantToRoom = async (
  roomId: string,
  userId: string,
  username: string
) => {
  try {
    const { error } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId,
        username: username
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding participant to room:', error);
  }
};

export const removeParticipantFromRoom = async (
  roomId: string,
  userId: string
) => {
  try {
    const { error } = await supabase
      .from('room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .is('left_at', null);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing participant from room:', error);
  }
};

export const getActiveParticipants = async (roomId: string) => {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .is('left_at', null);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting active participants:', error);
    return [];
  }
};

export const checkIfRoomEmpty = async (roomId: string) => {
  const participants = await getActiveParticipants(roomId);
  return participants.length === 0;
};
