#include "common/common.h"

// 客户端用到的 ACE 能力：
//   - ACE_Guard_T.h       ：RAII 锁守卫，配合互斥量自动加/解锁
//   - ACE_OS_NS_sys_socket.h：跨平台的 socket 初始化封装（Windows 下等价于 WSAStartup）
//   - ACE_Thread_Mutex.h  ：线程互斥量（保护发送与日志文件写）
#include <ace/Guard_T.h>
#include <ace/INET_Addr.h>
#include <ace/OS_NS_sys_socket.h>
#include <ace/SOCK_Connector.h>
#include <ace/SOCK_Stream.h>
#include <ace/Thread.h>
#include <ace/Thread_Mutex.h>

#include <atomic>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include <windows.h>

namespace {

struct ClientState {
    // ACE_SOCK_Stream：与 game_server 之间已建立的 TCP 连接通道（收发都靠它）。
    ACE_SOCK_Stream stream;
    // ACE_Thread_Mutex：保护 send_line 的互斥量，保证 UI 线程和接收线程不会同时写 socket。
    ACE_Thread_Mutex send_mutex;
    std::atomic<bool> running{true};
    std::atomic<bool> connected{false};
    std::string game_host = "127.0.0.1";
    uint16_t game_port = 5001;
    uint16_t dbcache_port = 9000;
    std::string player;
    HWND main_hwnd = nullptr;
};

ClientState g_state;
const char* kMainClass = "ACE_MMORPG_Client";
const char* kDiscoverClass = "ACE_MMORPG_Discover";

enum {
    WM_APP_RECV = WM_APP + 1
};

enum ControlId {
    IDC_LOGIN_EDIT = 101,
    IDC_LOGIN_BTN = 102,
    IDC_FRIEND_LIST = 103,
    IDC_DISCOVER_BTN = 104,
    IDC_CHAT_TARGET = 105,
    IDC_LOG = 106,
    IDC_MSG_EDIT = 107,
    IDC_SEND_BTN = 108,
    IDC_REFRESH_FRIENDS_BTN = 109,

    IDC_PLAYER_LIST = 201,
    IDC_ADD_FRIEND_BTN = 202,
    IDC_NEXT_BATCH_BTN = 203,
    IDC_CLOSE_DISCOVER_BTN = 204
};

HWND g_discover_hwnd = nullptr;
int g_discover_offset = 0;
std::string g_chat_target;
std::ofstream g_client_log;
// ACE_Thread_Mutex：保护日志文件的互斥量，因为 UI 线程和接收线程都会写同一个日志文件。
ACE_Thread_Mutex g_log_mutex;
std::string g_log_path;

std::string win_error_text(DWORD code) {
    char* buffer = nullptr;
    const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS;
    const DWORD len = FormatMessageA(flags, nullptr, code, 0, reinterpret_cast<char*>(&buffer), 0, nullptr);
    std::string text = len > 0 && buffer != nullptr ? std::string(buffer, len) : "unknown";
    if (buffer != nullptr) {
        LocalFree(buffer);
    }
    return demo::trim(text);
}

void file_log(const std::string& text) {
    // ACE_Guard 持有 g_log_mutex，构造时加锁、析构时自动解锁（RAII），保证多线程序列化写日志。
    ACE_Guard<ACE_Thread_Mutex> guard(g_log_mutex);
    if (g_client_log.is_open()) {
        g_client_log << "[" << demo::now_text() << "] " << text << "\n";
        g_client_log.flush();
    }
}

void init_client_log() {
    CreateDirectoryA("data", nullptr);
    CreateDirectoryA("data\\logs", nullptr);

    std::ostringstream path;
    path << "data\\logs\\client_" << GetCurrentProcessId() << ".log";
    g_log_path = path.str();
    g_client_log.open(g_log_path, std::ios::out | std::ios::app);
    file_log("client process started");
}

void append_log(const std::string& text) {
    file_log("UI " + text);
    if (g_state.main_hwnd == nullptr) {
        return;
    }
    HWND log = GetDlgItem(g_state.main_hwnd, IDC_LOG);
    if (log == nullptr) {
        return;
    }

    const int len = GetWindowTextLengthA(log);
    std::string current;
    if (len > 0) {
        current.resize(static_cast<size_t>(len) + 1);
        GetWindowTextA(log, current.data(), len + 1);
        current.resize(static_cast<size_t>(len));
    }

    current += text;
    current += "\r\n";
    SetWindowTextA(log, current.c_str());
    SendMessageA(log, EM_SETSEL, static_cast<WPARAM>(current.size()), static_cast<LPARAM>(current.size()));
    SendMessageA(log, EM_SCROLLCARET, 0, 0);
}

bool send_cmd(const std::string& line) {
    if (!g_state.connected.load()) {
        append_log("[local] not connected to game_server");
        file_log("TX skipped because socket is not connected: " + line);
        return false;
    }

    // g_state.send_mutex 用 ACE_Thread_Mutex 保证：UI 线程发送时，接收线程不会同时操作 socket。
    ACE_Guard<ACE_Thread_Mutex> guard(g_state.send_mutex);
    file_log("TX game_server: " + line);
    if (!demo::send_line(g_state.stream, line)) {
        const DWORD err = WSAGetLastError();
        file_log("TX failed, WSAGetLastError=" + std::to_string(err) + " " + win_error_text(err));
        return false;
    }
    return true;
}

void request_friend_list() {
    if (g_state.player.empty()) {
        append_log("[local] login first before refreshing friends");
        return;
    }
    send_cmd("friend list");
}

void update_friend_list(const std::vector<std::string>& parts) {
    HWND list = GetDlgItem(g_state.main_hwnd, IDC_FRIEND_LIST);
    if (list == nullptr) {
        return;
    }

    SendMessageA(list, LB_RESETCONTENT, 0, 0);
    if (parts.size() < 3) {
        return;
    }

    const int count = demo::parse_int(parts[2].c_str(), 0);
    for (int i = 0; i < count; ++i) {
        const size_t index = static_cast<size_t>(3 + i);
        if (index >= parts.size()) {
            break;
        }
        SendMessageA(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(parts[index].c_str()));
    }
}

void handle_server_line(const std::string& line) {
    file_log("RX game_server: " + line);
    append_log(line);
    const auto parts = demo::split_ws(line);

    if (parts.size() >= 3 && parts[0] == "OK" && parts[1] == "login") {
        g_state.player = parts[2];
        request_friend_list();
    } else if (parts.size() >= 3 && parts[0] == "OK" && parts[1] == "FRIEND_ADDED") {
        append_log("[local] friend added: " + parts[2]);
        request_friend_list();
    } else if (parts.size() >= 2 && parts[0] == "OK" && parts[1] == "FRIENDS") {
        update_friend_list(parts);
    }
}

// 接收线程：在一条独立的 std::thread 里循环从 ACE_SOCK_Stream 读游戏服务器推送的行。
// 每读一行就 new 出来通过 PostMessage 投给 UI 线程处理（避免直接在后台线程动窗口控件）。
ACE_THR_FUNC_RETURN recv_thread(void* arg) {
    auto* state = static_cast<ClientState*>(arg);
    file_log("recv thread started");
    std::string line;
    while (state->running.load() && demo::recv_line(state->stream, line)) {
        if (state->main_hwnd != nullptr) {
            auto* copy = new std::string(line);
            PostMessageA(state->main_hwnd, WM_APP_RECV, 0, reinterpret_cast<LPARAM>(copy));
        }
        if (line == "bye") {
            break;
        }
    }
    const DWORD err = WSAGetLastError();
    file_log("recv thread stopped, connected=false, WSAGetLastError=" + std::to_string(err) + " " + win_error_text(err));
    state->connected.store(false);
    state->running.store(false);
    return 0;
}

void do_login(const std::string& name) {
    if (name.empty()) {
        append_log("[local] enter a player name first");
        return;
    }
    if (send_cmd("login " + name)) {
        append_log("[local] login request sent: " + name);
    }
}

void fetch_server_players(HWND hwnd, int offset) {
    demo::Endpoint dbcache{g_state.game_host, g_state.dbcache_port};
    std::string response;
    file_log("TX dbcache: LIST_PLAYERS " + std::to_string(offset) + " 10 to " + dbcache.host + ":" + std::to_string(dbcache.port));
    if (!demo::request_line(dbcache, "LIST_PLAYERS " + std::to_string(offset) + " 10", &response)) {
        const DWORD err = WSAGetLastError();
        file_log("dbcache connect/request failed, WSAGetLastError=" + std::to_string(err) + " " + win_error_text(err));
        MessageBoxA(hwnd, "Cannot connect to dbcache_server.", "Discover Players", MB_OK | MB_ICONERROR);
        return;
    }
    file_log("RX dbcache: " + response);

    HWND list = GetDlgItem(hwnd, IDC_PLAYER_LIST);
    SendMessageA(list, LB_RESETCONTENT, 0, 0);

    const auto parts = demo::split_ws(response);
    if (parts.size() < 3 || parts[0] != "OK" || parts[1] != "LIST") {
        SendMessageA(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>("[empty] no players"));
        return;
    }

    const int count = demo::parse_int(parts[2].c_str(), 0);
    for (int i = 0; i < count; ++i) {
        const size_t base = static_cast<size_t>(3 + i * 2);
        if (base + 1 >= parts.size()) {
            break;
        }
        const std::string entry = parts[base] + " (Lv." + parts[base + 1] + ")";
        SendMessageA(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(entry.c_str()));
    }

    if (count == 0) {
        SendMessageA(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>("[empty] no more players"));
    }
}

std::string selected_player_name(HWND list) {
    const int selected = static_cast<int>(SendMessageA(list, LB_GETCURSEL, 0, 0));
    if (selected < 0) {
        return {};
    }

    char buffer[256] = {0};
    SendMessageA(list, LB_GETTEXT, static_cast<WPARAM>(selected), reinterpret_cast<LPARAM>(buffer));
    std::string entry = demo::trim(buffer);
    const size_t split = entry.find(' ');
    if (split != std::string::npos) {
        entry = entry.substr(0, split);
    }
    if (entry.empty() || entry[0] == '[') {
        return {};
    }
    return entry;
}

void add_selected_player(HWND hwnd) {
    if (g_state.player.empty()) {
        MessageBoxA(hwnd, "Login first.", "Add Friend", MB_OK | MB_ICONINFORMATION);
        return;
    }

    const std::string name = selected_player_name(GetDlgItem(hwnd, IDC_PLAYER_LIST));
    if (name.empty()) {
        MessageBoxA(hwnd, "Select one player first.", "Add Friend", MB_OK | MB_ICONINFORMATION);
        return;
    }
    if (name == g_state.player) {
        MessageBoxA(hwnd, "Cannot add yourself.", "Add Friend", MB_OK | MB_ICONINFORMATION);
        return;
    }

    if (send_cmd("friend add " + name)) {
        append_log("[local] add friend request sent: " + name);
    }
}

LRESULT CALLBACK discover_wnd_proc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam) {
    switch (msg) {
        case WM_CREATE:
            CreateWindowA("LISTBOX", nullptr,
                WS_CHILD | WS_VISIBLE | WS_BORDER | LBS_NOTIFY | WS_VSCROLL,
                10, 10, 360, 300, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_PLAYER_LIST)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Add Friend", WS_CHILD | WS_VISIBLE,
                10, 320, 105, 30, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_ADD_FRIEND_BTN)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Next 10", WS_CHILD | WS_VISIBLE,
                130, 320, 105, 30, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_NEXT_BATCH_BTN)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Close", WS_CHILD | WS_VISIBLE,
                250, 320, 105, 30, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_CLOSE_DISCOVER_BTN)),
                nullptr, nullptr);
            fetch_server_players(hwnd, g_discover_offset);
            return 0;

        case WM_COMMAND: {
            const int id = LOWORD(wparam);
            if (id == IDC_ADD_FRIEND_BTN || (id == IDC_PLAYER_LIST && HIWORD(wparam) == LBN_DBLCLK)) {
                add_selected_player(hwnd);
            } else if (id == IDC_NEXT_BATCH_BTN) {
                g_discover_offset += 10;
                fetch_server_players(hwnd, g_discover_offset);
            } else if (id == IDC_CLOSE_DISCOVER_BTN) {
                DestroyWindow(hwnd);
            }
            return 0;
        }

        case WM_DESTROY:
            g_discover_hwnd = nullptr;
            g_discover_offset = 0;
            return 0;
    }
    return DefWindowProcA(hwnd, msg, wparam, lparam);
}

void choose_friend_for_chat(HWND hwnd) {
    HWND list = GetDlgItem(hwnd, IDC_FRIEND_LIST);
    const int selected = static_cast<int>(SendMessageA(list, LB_GETCURSEL, 0, 0));
    if (selected < 0) {
        return;
    }

    char buffer[128] = {0};
    SendMessageA(list, LB_GETTEXT, static_cast<WPARAM>(selected), reinterpret_cast<LPARAM>(buffer));
    g_chat_target = demo::trim(buffer);
    SetWindowTextA(GetDlgItem(hwnd, IDC_CHAT_TARGET), g_chat_target.c_str());
    append_log("[local] chat target: " + g_chat_target);
}

void send_chat(HWND hwnd) {
    if (g_chat_target.empty()) {
        append_log("[local] double-click a friend before chatting");
        return;
    }

    char buffer[1024] = {0};
    GetWindowTextA(GetDlgItem(hwnd, IDC_MSG_EDIT), buffer, sizeof(buffer));
    const std::string message = demo::trim(buffer);
    if (message.empty()) {
        return;
    }

    if (send_cmd("say " + g_chat_target + " " + message)) {
        append_log("[me -> " + g_chat_target + "] " + message);
        SetWindowTextA(GetDlgItem(hwnd, IDC_MSG_EDIT), "");
    }
}

LRESULT CALLBACK main_wnd_proc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam) {
    switch (msg) {
        case WM_CREATE:
            g_state.main_hwnd = hwnd;

            CreateWindowA("STATIC", "Player:", WS_CHILD | WS_VISIBLE,
                10, 14, 55, 20, hwnd, nullptr, nullptr, nullptr);
            CreateWindowA("EDIT", nullptr, WS_CHILD | WS_VISIBLE | WS_BORDER,
                65, 10, 140, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_LOGIN_EDIT)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Login", WS_CHILD | WS_VISIBLE,
                215, 10, 80, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_LOGIN_BTN)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Discover", WS_CHILD | WS_VISIBLE,
                305, 10, 90, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_DISCOVER_BTN)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Friends", WS_CHILD | WS_VISIBLE,
                405, 10, 80, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_REFRESH_FRIENDS_BTN)),
                nullptr, nullptr);

            CreateWindowA("STATIC", "Friends", WS_CHILD | WS_VISIBLE,
                10, 45, 180, 20, hwnd, nullptr, nullptr, nullptr);
            CreateWindowA("LISTBOX", nullptr,
                WS_CHILD | WS_VISIBLE | WS_BORDER | LBS_NOTIFY | WS_VSCROLL,
                10, 68, 190, 220, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_FRIEND_LIST)),
                nullptr, nullptr);

            CreateWindowA("STATIC", "Chat Target:", WS_CHILD | WS_VISIBLE,
                215, 45, 85, 20, hwnd, nullptr, nullptr, nullptr);
            CreateWindowA("EDIT", nullptr, WS_CHILD | WS_VISIBLE | WS_BORDER | ES_READONLY,
                305, 42, 180, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_CHAT_TARGET)),
                nullptr, nullptr);
            CreateWindowA("EDIT", nullptr,
                WS_CHILD | WS_VISIBLE | WS_BORDER | ES_MULTILINE | ES_AUTOVSCROLL | ES_READONLY | WS_VSCROLL,
                215, 68, 390, 220, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_LOG)),
                nullptr, nullptr);
            CreateWindowA("EDIT", nullptr, WS_CHILD | WS_VISIBLE | WS_BORDER,
                215, 300, 310, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_MSG_EDIT)),
                nullptr, nullptr);
            CreateWindowA("BUTTON", "Send", WS_CHILD | WS_VISIBLE,
                535, 300, 70, 24, hwnd,
                reinterpret_cast<HMENU>(static_cast<INT_PTR>(IDC_SEND_BTN)),
                nullptr, nullptr);

            if (!g_state.player.empty()) {
                SetWindowTextA(GetDlgItem(hwnd, IDC_LOGIN_EDIT), g_state.player.c_str());
            }
            return 0;

        case WM_APP_RECV: {
            auto* text = reinterpret_cast<std::string*>(lparam);
            if (text != nullptr) {
                const std::string line = *text;
                delete text;
                handle_server_line(line);
            }
            return 0;
        }

        case WM_COMMAND: {
            const int id = LOWORD(wparam);
            if (id == IDC_LOGIN_BTN) {
                char buffer[128] = {0};
                GetWindowTextA(GetDlgItem(hwnd, IDC_LOGIN_EDIT), buffer, sizeof(buffer));
                do_login(demo::trim(buffer));
            } else if (id == IDC_DISCOVER_BTN) {
                if (g_discover_hwnd == nullptr) {
                    g_discover_offset = 0;
                    g_discover_hwnd = CreateWindowA(kDiscoverClass, "Discover Players",
                        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                        CW_USEDEFAULT, CW_USEDEFAULT, 395, 395,
                        hwnd, nullptr, GetModuleHandleA(nullptr), nullptr);
                } else {
                    SetForegroundWindow(g_discover_hwnd);
                }
            } else if (id == IDC_REFRESH_FRIENDS_BTN) {
                request_friend_list();
            } else if (id == IDC_SEND_BTN) {
                send_chat(hwnd);
            } else if (id == IDC_FRIEND_LIST && HIWORD(wparam) == LBN_DBLCLK) {
                choose_friend_for_chat(hwnd);
            }
            return 0;
        }

        case WM_DESTROY:
            g_state.running.store(false);
            if (g_state.connected.load()) {
                send_cmd("quit");
            }
            g_state.stream.close();
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcA(hwnd, msg, wparam, lparam);
}

}  // namespace

int WINAPI WinMain(HINSTANCE instance, HINSTANCE, LPSTR, int) {
    init_client_log();
    // ACE_OS::socket_init：跨平台地初始化底层 socket 子系统。
    // Windows 上等价于 WSAStartup(MAKEWORD(2,2), ...)，必须在使用任何 socket 前调用；
    // 非 Windows 平台这是个空操作。参数 (2,2) 对应 Winsock 2.2。
    if (ACE_OS::socket_init(2, 2) != 0) {
        const DWORD err = WSAGetLastError();
        file_log("ACE_OS::socket_init failed, WSAGetLastError=" + std::to_string(err) + " " + win_error_text(err));
        MessageBoxA(nullptr, "Cannot initialize Winsock.", "ACE MMORPG Client", MB_OK | MB_ICONERROR);
        return 1;
    }

    for (int i = 1; i < __argc; ++i) {
        const std::string arg = __argv[i];
        if (arg == "--host" && i + 1 < __argc) {
            g_state.game_host = __argv[++i];
        } else if (arg == "--port" && i + 1 < __argc) {
            g_state.game_port = static_cast<uint16_t>(demo::parse_int(__argv[++i], g_state.game_port));
        } else if (arg == "--dbcache-port" && i + 1 < __argc) {
            g_state.dbcache_port = static_cast<uint16_t>(demo::parse_int(__argv[++i], g_state.dbcache_port));
        } else if (arg == "--login" && i + 1 < __argc) {
            g_state.player = __argv[++i];
        }
    }
    file_log("args parsed: game=" + g_state.game_host + ":" + std::to_string(g_state.game_port) +
             " dbcache_port=" + std::to_string(g_state.dbcache_port) +
             " login=" + (g_state.player.empty() ? "<none>" : g_state.player));

    WNDCLASSA main_wc{};
    main_wc.lpfnWndProc = main_wnd_proc;
    main_wc.hInstance = instance;
    main_wc.lpszClassName = kMainClass;
    main_wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
    main_wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassA(&main_wc);

    WNDCLASSA discover_wc{};
    discover_wc.lpfnWndProc = discover_wnd_proc;
    discover_wc.hInstance = instance;
    discover_wc.lpszClassName = kDiscoverClass;
    discover_wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
    discover_wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassA(&discover_wc);

    HWND main_wnd = CreateWindowA(kMainClass, "ACE MMORPG Client",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT, 635, 380,
        nullptr, nullptr, instance, nullptr);
    if (main_wnd == nullptr) {
        const DWORD err = GetLastError();
        file_log("CreateWindow failed, GetLastError=" + std::to_string(err) + " " + win_error_text(err));
        MessageBoxA(nullptr, "Failed to create main window.", "ACE MMORPG Client", MB_OK | MB_ICONERROR);
        ACE_OS::socket_fini();
        return 1;
    }
    append_log("[local] log file: " + g_log_path);

    // ACE_INET_Addr：把 "game_host:game_port" 封装成 ACE 网络地址对象。
    ACE_INET_Addr addr(g_state.game_port, g_state.game_host.c_str());
    // ACE_SOCK_Connector：主动连接方（对应 BSD socket + connect）。
    ACE_SOCK_Connector connector;
    file_log("connecting to game_server " + g_state.game_host + ":" + std::to_string(g_state.game_port));
    // connector.connect：建立到 game_server 的 TCP 连接；成功后 g_state.stream 成为已连接通道。
    if (connector.connect(g_state.stream, addr) != 0) {
        const DWORD err = WSAGetLastError();
        const std::string details =
            "connect failed to game_server " + g_state.game_host + ":" + std::to_string(g_state.game_port) +
            ", WSAGetLastError=" + std::to_string(err) + " " + win_error_text(err);
        file_log(details);
        const std::string message =
            "Cannot connect to game_server.\n\nTarget: " + g_state.game_host + ":" + std::to_string(g_state.game_port) +
            "\nError: " + std::to_string(err) + " " + win_error_text(err) +
            "\nLog: " + g_log_path;
        MessageBoxA(main_wnd, message.c_str(), "Connection Failed", MB_OK | MB_ICONERROR);
    } else {
        g_state.connected.store(true);
        file_log("connected to game_server");
        append_log("[local] connected to game_server " + g_state.game_host + ":" + std::to_string(g_state.game_port));
        try {
            std::thread([]() { recv_thread(&g_state); }).detach();
            file_log("recv thread spawned");
        } catch (const std::exception& ex) {
            file_log(std::string("recv thread spawn failed: ") + ex.what());
            MessageBoxA(main_wnd, "Failed to start receive thread.", "ACE MMORPG Client", MB_OK | MB_ICONERROR);
        }
        if (!g_state.player.empty()) {
            do_login(g_state.player);
        }
    }

    MSG msg{};
    while (GetMessageA(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }

    g_state.running.store(false);
    g_state.stream.close();
    file_log("client process exiting");
    // ACE_OS::socket_fini：与 socket_init 配对，Windows 上等价于 WSACleanup，释放 socket 子系统。
    ACE_OS::socket_fini();
    return 0;
}
