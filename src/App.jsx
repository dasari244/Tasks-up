import React from 'react';
import TodoList from './TodoList';
import supabase from './supabaseClient';


function App() {
    return (
        <>
            <TodoList />
        </>
    )
}

export default App;
