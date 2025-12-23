import React, { useState, useEffect, useRef } from "react";
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

/* Parse userDate string to a Date object */
function parseUserDate(userDateStr) {
    if (!userDateStr) return null;

    // Match date part: DD-MM-YYYY or DD/MM/YYYY
    const dateMatch = userDateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!dateMatch) return null;

    let day = parseInt(dateMatch[1], 10);
    let month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-indexed
    let year = parseInt(dateMatch[3], 10);

    // Handle 2-digit year
    if (year < 100) {
        year += 2000;
    }

    // Match time part: HH:MM AM/PM or HH:MM
    const timeMatch = userDateStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)?/i);
    let hours = 0;
    let minutes = 0;

    if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const period = timeMatch[3];

        if (period) {
            // Convert 12-hour to 24-hour format
            if (period.toUpperCase() === "PM" && hours !== 12) {
                hours += 12;
            } else if (period.toUpperCase() === "AM" && hours === 12) {
                hours = 0;
            }
        }
    }

    return new Date(year, month, day, hours, minutes, 0, 0);
}

/* Send browser notification */
function sendNotification(task) {
    if (Notification.permission === "granted") {
        const notification = new Notification("⏰ Task Reminder!", {
            body: `It's time for: ${task.text}`,
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>",
            tag: `task-${task.id}`,
            requireInteraction: true,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // Auto close after 10 seconds
        setTimeout(() => notification.close(), 10000);
    }
}

function TodoList() {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [editingDate, setEditingDate] = useState("");
    const [filter, setFilter] = useState("all"); // ⭐ NEW
    const [notificationPermission, setNotificationPermission] = useState(
        "Notification" in window ? Notification.permission : "denied"
    );
    const [toast, setToast] = useState(null); // In-app toast notification
    const notifiedTasksRef = useRef(new Set()); // Track which tasks have been notified
    const activeCount = tasks.filter((t) => !t.completed).length;

    // Show in-app toast notification (works on all devices including mobile)
    function showToast(task) {
        setToast({
            title: "⏰ Task Reminder!",
            body: `It's time for: ${task.text}`
        });

        // Play sound alert
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVovVo/X7NFoOQ0untnq4LR6Sihdl9zb1K6NW0xejtXf1dC2mWZXX4jK2+DawaWRc2twgLnL2OXlvcWwj4KEd5y1y9flw7+2spiVk4ubnKnA2Oru59HDs6adj5acpLK+087a2M3CtK+elpmirLm+ztXMvLSsnZqYnaWstb7Q08C3r6Odn6etrrbCzszAvLapo6Kkqa2zurq6trKso6Oip62vtbu5ubiyq6ejpKqtrrK2tra0sauoo6SmqqywtbS0s7Cuq6ekpaiqrLCysrKxr6yppaWnqauusLGysK+tq6ilpqipq66wsLCvramop6aoqaytr7CwsK6sqaenpqiqq62ur6+urKupqKenqKqrrK2urq2sqainp6eoqqutrK2trKuqqKenqKmqq6ytra2sq6qoqKeoqaqrrKytrKuqqKinqKmqq6usrKyrq6mop6eoqaqrq6ysrKuqqainqKmqqqurrKyrq6qpqKeoqamqq6urq6urqamop6ioqaqrq6urq6qpqaioqKmqqqurq6uqqamop6ioqamqq6urqqqpqaiop6ipqaqqq6uqqamoqKeoqampqquqqqmpqKinqKipqaqqqqmpqKioqKipqamqqqmpqKioqKioqampqamqqaiop6ioqKmpqampqKioqKioqampqampqKioqKioqKmpqampqaioqKioqKioqampqampqKioqKioqKipqampqaioqKioqKioqKmpqamoqKioqKioqKipqampqKioqKioqKioqKmpqamoqKioqKioqKioqampqaioqKioqKioqKioqampqKioqKioqKioqKioqKipqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKg==');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) { }

        // Auto hide after 5 seconds
        setTimeout(() => {
            setToast(null);
        }, 5000);
    }

    // Request notification permission on mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
                setNotificationPermission(permission);
            });
        }
    }, []);

    // Real-time notification check - runs every second for precise timing
    useEffect(() => {
        function checkDueTasks() {
            const now = new Date();

            tasks.forEach((task) => {
                // Skip if already completed or already notified
                if (task.completed || notifiedTasksRef.current.has(task.id)) return;

                const taskDate = parseUserDate(task.userDate);
                if (!taskDate) return;

                // Check if the task is due (within 5 second window for real-time precision)
                const timeDiff = taskDate.getTime() - now.getTime();

                // Notify if task is due (between -5 seconds and +5 seconds for real-time trigger)
                if (timeDiff >= -5000 && timeDiff <= 5000) {
                    // Show in-app toast (works on mobile!)
                    showToast(task);

                    // Also try browser notification (works on desktop)
                    sendNotification(task);

                    notifiedTasksRef.current.add(task.id);
                    console.log(`🔔 Notification sent for: ${task.text} at ${now.toLocaleTimeString()}`);
                }
            });
        }

        // Initial check
        checkDueTasks();

        // Check every 1 second for real-time notifications
        const interval = setInterval(checkDueTasks, 1000);

        return () => clearInterval(interval);
    }, [tasks]);


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
    async function clearCompleted() {
        await supabase
            .from("tasks")
            .delete()
            .eq("completed", true);
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
            {/* In-app toast notification for mobile */}
            {toast && (
                <div className="notification-toast" onClick={() => setToast(null)}>
                    <div className="toast-title">{toast.title}</div>
                    <div className="toast-body">{toast.body}</div>
                </div>
            )}

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
                <span className="task-count">{activeCount} items left</span>

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

                <button className="status-btn clear-btn" onClick={clearCompleted}>
                    Clear Completed
                </button>
            </div>

        </div>
    );
}

export default TodoList;
