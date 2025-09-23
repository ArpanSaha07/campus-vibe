package com.campusvibe.user;

import java.util.List;
import java.util.Optional;

public interface UserDao {
    List<User> selectAllUsers();
    Optional<User> selectUserById(Integer customerId);
    void insertUser(User customer);
    boolean existsUserWithEmail(String email);
    boolean existsUserById(Integer customerId);
    void deleteUserById(Integer customerId);
    void updateUser(User update);
    Optional<User> selectUserByEmail(String email);
    void updateUserProfileImageId(String profileImageId, Integer customerId);
}
