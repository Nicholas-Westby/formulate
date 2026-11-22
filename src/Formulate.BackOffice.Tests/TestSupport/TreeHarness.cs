using Formulate.BackOffice.Persistence;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Validations;

namespace Formulate.BackOffice.Tests.TestSupport;

/// <summary>The real tree entity repository over the in-memory repositories, with helpers that add entities.</summary>
internal sealed class TreeHarness
{
    public TreeHarness()
    {
        Tree = new TreeEntityRepository(Repositories.Forms, Repositories.Layouts, Repositories.Folders, Repositories.DataValues, Repositories.Validations);
    }

    public RepositoryHarness Repositories { get; } = new();

    public TreeEntityRepository Tree { get; }

    public PersistedFolder AddFolder(Guid root, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = "Folder", Alias = "folder-alias", Path = new[] { root }.Concat(parents).Append(id).ToArray() };
        Repositories.Folders.Save(folder);
        return folder;
    }

    public PersistedForm AddForm(params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var form = new PersistedForm { Id = id, Name = "Form", Path = new[] { FormConstantsRoot.Forms }.Concat(parents).Append(id).ToArray() };
        Repositories.Forms.Save(form);
        return form;
    }

    public PersistedLayout AddLayout(PersistedForm form)
    {
        var id = Guid.NewGuid();
        var layout = new PersistedLayout { Id = id, Name = "Layout", Path = form.Path.Append(id).ToArray() };
        Repositories.Layouts.Save(layout);
        return layout;
    }

    public PersistedValidation AddValidation(params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var validation = new PersistedValidation { Id = id, Name = "Validation", Path = new[] { FormConstantsRoot.Validations }.Concat(parents).Append(id).ToArray() };
        Repositories.Validations.Save(validation);
        return validation;
    }

    public PersistedDataValues AddDataValues(params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var dataValues = new PersistedDataValues { Id = id, Name = "Data values", Path = new[] { FormConstantsRoot.DataValues }.Concat(parents).Append(id).ToArray() };
        Repositories.DataValues.Save(dataValues);
        return dataValues;
    }
}
