namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using Formulate.BackOffice.Api.Models.Tree;

    /// <summary>
    /// Lists what can be created under a place in a tree.
    /// </summary>
    public interface ICreateOptionsApiService
    {
        /// <summary>
        /// Gets what can be created under a place in a tree.
        /// </summary>
        /// <param name="treeAlias">One of the <see cref="TreeAliases"/> values.</param>
        /// <param name="parentId">The ID of the folder or form to create under; null for the top of the tree.</param>
        /// <returns>
        /// The options, which are empty when nothing can be created there. An unknown tree is invalid, and
        /// a parent that is not in the tree is not found.
        /// </returns>
        ServiceResult<IReadOnlyList<CreateOptionModel>> GetCreateOptions(string treeAlias, Guid? parentId);
    }
}
