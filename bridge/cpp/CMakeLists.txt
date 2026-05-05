cmake_minimum_required(VERSION 3.16)
project(native_bridge_cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(native_bridge_client
    src/bridge_client.cpp
)

target_include_directories(native_bridge_client PUBLIC include)

add_executable(native_bridge_example src/main.cpp)
target_link_libraries(native_bridge_example PRIVATE native_bridge_client)
