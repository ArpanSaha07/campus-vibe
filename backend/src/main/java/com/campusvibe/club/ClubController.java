package com.campusvibe.club;

import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.user.Role;
import com.campusvibe.user.User;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1/clubs")
public class ClubController {

    private final ClubService clubService;
    private final ClubMapper clubMapper;
    private final S3Service s3Service;
    private final S3Buckets buckets;

    public ClubController(ClubService clubService, ClubMapper clubMapper, S3Service s3Service, S3Buckets buckets) {
        this.clubService = clubService;
        this.clubMapper = clubMapper;
        this.s3Service = s3Service;
        this.buckets = buckets;
    }

    @GetMapping
    public List<ClubDTO> list() {
        return clubService.list().stream().map(clubMapper).toList();
    }

    @GetMapping("/{id}")
    public ClubDTO get(@PathVariable String id) {
        return clubMapper.apply(clubService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','CLUB_ADMIN')")
    public ClubDTO create(@RequestBody ClubCreateRequest request, Authentication auth) {
        User user = (User) auth.getPrincipal();
        if (user.getRole() == Role.CLUB_ADMIN) {
            // For club admins, force the id to their managed club
            if (user.getManagedClub() == null || !user.getManagedClub().getId().equals(request.id())) {
                throw new RuntimeException("Club admin can only create their own club");
            }
        }
        Club club = new Club();
        club.setId(request.id());
        club.setName(request.name());
        club.setDescription(request.description());
        return clubMapper.apply(clubService.create(club));
    }

    @PostMapping(path = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CLUB_ADMIN')")
    public void uploadLogo(@PathVariable String id, @RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
        authorizeClubWrite(id, auth);
        String key = "clubs/" + id + "/logo-" + file.getOriginalFilename();
        s3Service.putObject(buckets.getClubs(), key, file.getBytes());
        clubService.updateLogo(id, key);
    }

    @PostMapping(path = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CLUB_ADMIN')")
    public void uploadImages(@PathVariable String id, @RequestPart("files") List<MultipartFile> files, Authentication auth) throws IOException {
        authorizeClubWrite(id, auth);
        for (MultipartFile file : files) {
            String key = "clubs/" + id + "/images/" + file.getOriginalFilename();
            s3Service.putObject(buckets.getClubs(), key, file.getBytes());
            clubService.addImages(id, List.of(key));
        }
    }

    private void authorizeClubWrite(String clubId, Authentication auth) {
        User user = (User) auth.getPrincipal();
        if (user.getRole() == Role.CLUB_ADMIN) {
            if (user.getManagedClub() == null || !user.getManagedClub().getId().equals(clubId)) {
                throw new RuntimeException("Forbidden");
            }
        }
    }
}
