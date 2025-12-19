import React, { useState, useEffect } from "react";
import supabase from "./supabaseClient";

/* Extract full date + optional time */
function extractDateTime(text) {
    const regex =
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(\s+\d{1,2}:\d{2}\s?(AM|PM)?)?/i;
    return text.match(regex)?.[0] || null;
}

function extractTimeOnly(text) {
    const timeRegex = /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i;
    return text.match(timeRegex)?.[0] || null;
}

function removeDateTime(text) {
    return text
        .replace(
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(\s+\d{1,2}:\d{2}\s?(AM|PM)?)?/i,
            ""
        )
        .trim();
}

function getTodayDate() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function TodoList() {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [editingDate, setEditingDate] = useState("");
    const [filter, setFilter] = useState("all"); // ⭐ NEW

    async function loadTasks() {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .order("id", { ascending: false });

        if (!error) setTasks(data);
    }

    useEffect(() => {
        loadTasks();
        const channel = supabase
            .channel("realtime-tasks")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tasks" },
                () => loadTasks()
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    async function addTask(e) {
        e.preventDefault();
        if (!newTask.trim()) return;

        const fullDate = extractDateTime(newTask);
        const timeOnly = extractTimeOnly(newTask);

        let finalDate = fullDate;
        if (!fullDate && timeOnly) {
            finalDate = getTodayDate();
        }

        await supabase.from("tasks").insert({
            text: removeDateTime(newTask),
            userDate: finalDate,
            completed: false,
        });

        setNewTask("");
    }

    function startEdit(task) {
        setEditingId(task.id);
        setEditingText(task.text);
        setEditingDate(task.userDate || "");
    }

    async function saveEdit(id) {
        await supabase
            .from("tasks")
            .update({ text: editingText, userDate: editingDate })
            .eq("id", id);

        setEditingId(null);
        setEditingText("");
        setEditingDate("");
    }

    function cancelEdit() {
        setEditingId(null);
        setEditingText("");
        setEditingDate("");
    }

    async function deleteTask(id) {
        await supabase.from("tasks").delete().eq("id", id);
    }

    async function toggleComplete(task) {
        await supabase
            .from("tasks")
            .update({ completed: !task.completed })
            .eq("id", task.id);
    }

    // ⭐ FILTER LOGIC
    const filteredTasks = tasks.filter((task) => {
        if (filter === "all") return true;
        if (filter === "active") return !task.completed;
        if (filter === "completed") return task.completed;
        return true;
    });

    return (
        <div className="to-do-list">
            <h1>To-Do-List</h1>

            <form onSubmit={addTask}>
                <input
                    type="text"
                    placeholder="Add new task"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                />
                <button type="submit" className="add-button">
                    Add Task
                </button>
            </form>

            <ol>
                {filteredTasks.map((task) => (
                    <li key={task.id} style={{ display: "flex", alignItems: "center" }}>
                        <label className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => toggleComplete(task)}
                            />
                            <span className="checkmark"></span>
                        </label>

                        {editingId === task.id ? (
                            <div className="edit-section">
                                <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                />

                                <input
                                    type="text"
                                    className="date-input"
                                    value={editingDate}
                                    onChange={(e) => setEditingDate(e.target.value)}
                                />

                                <button className="save-button" onClick={() => saveEdit(task.id)}>
                                    ✔
                                </button>
                                <button className="cancel-button" onClick={cancelEdit}>
                                    ✖
                                </button>
                            </div>
                        ) : (
                            <div className="view-section">
                                <div className="text">
                                    <span
                                        style={{
                                            textDecoration: task.completed ? "line-through" : "none",
                                            opacity: task.completed ? 0.5 : 1,
                                        }}
                                    >
                                        {task.text}
                                    </span>
                                </div>

                                <div className="meta">
                                    {task.userDate && <span className="date">{task.userDate}</span>}

                                    <div className="actions">
                                        <button
                                            className="edit-button"
                                            onClick={() => startEdit(task)}
                                            disabled={task.completed}
                                        >
                                            &#9998;
                                        </button>
                                        <button
                                            className="delete-button"
                                            onClick={() => deleteTask(task.id)}
                                            disabled={task.completed}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ol>

            {/* ⭐ FILTER BUTTON BAR */}
            <div className="status-bar">
                <button
                    className={filter === "all" ? "status-btn active" : "status-btn"}
                    onClick={() => setFilter("all")}
                >
                    All
                </button>

                <button
                    className={filter === "active" ? "status-btn active" : "status-btn"}
                    onClick={() => setFilter("active")}
                >
                    Active
                </button>

                <button
                    className={filter === "completed" ? "status-btn active" : "status-btn"}
                    onClick={() => setFilter("completed")}
                >
                    Completed
                </button>
            </div>
        </div>
    );
}

export default TodoList;
