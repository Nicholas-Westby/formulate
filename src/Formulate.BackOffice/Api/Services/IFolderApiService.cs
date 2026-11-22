namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Models.Folder;
    using Formulate.BackOffice.Api.Models.Shared;

    /// <summary>
    /// Reads and changes folders for the Management API.
    /// </summary>
    public interface IFolderApiService
    {
        /// <summary>
        /// Gets a folder.
        /// </summary>
        ServiceResult<FolderResponseModel> Get(Guid id);

        /// <summary>
        /// Creates a folder at the top of a tree, or in a folder of that tree.
        /// </summary>
        ServiceResult<FolderResponseModel> Create(CreateFolderRequestModel request);

        /// <summary>
        /// Renames a folder, keeping its alias and place.
        /// </summary>
        ServiceResult<FolderResponseModel> Update(Guid id, UpdateFolderRequestModel request);

        /// <summary>
        /// Deletes a folder and everything under it, listing every deleted ID.
        /// </summary>
        ServiceResult<DeleteResponseModel> Delete(Guid id);
    }
}
